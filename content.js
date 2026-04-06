let appState = {
  folders: []
};

let domSyncScheduled = false;

function createFolderObject(name = 'New Folder') {
  return {
    id: 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name,
    color: '#4285F4',
    isExpanded: true,
    chats: [],
    subfolders: []
  };
}

function normalizeFolder(folder) {
  return {
    id: folder?.id || 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: folder?.name || 'New Folder',
    color: folder?.color || '#4285F4',
    isExpanded: folder?.isExpanded !== false,
    chats: Array.isArray(folder?.chats) ? folder.chats : [],
    subfolders: Array.isArray(folder?.subfolders)
      ? folder.subfolders.map(normalizeFolder)
      : []
  };
}

function normalizeStateFolders() {
  appState.folders = Array.isArray(appState.folders)
    ? appState.folders.map(normalizeFolder)
    : [];
}

function removeChatFromFolders(chatHref, folders = appState.folders) {
  folders.forEach(folder => {
    folder.chats = folder.chats.filter(href => href !== chatHref);
    removeChatFromFolders(chatHref, folder.subfolders);
  });
}

function findFolderContainingChat(chatHref, folders = appState.folders) {
  for (const folder of folders) {
    if (folder.chats.includes(chatHref)) {
      return folder;
    }

    const subfolderMatch = findFolderContainingChat(chatHref, folder.subfolders);
    if (subfolderMatch) {
      return subfolderMatch;
    }
  }

  return null;
}

function removeFolderById(folderId, folders = appState.folders) {
  for (let i = folders.length - 1; i >= 0; i -= 1) {
    const folder = folders[i];

    if (folder.id === folderId) {
      folders.splice(i, 1);
      return true;
    }

    if (removeFolderById(folderId, folder.subfolders)) {
      return true;
    }
  }

  return false;
}

// something is very fucked with the folder sync but idk what. works for now
async function init() {
  try {
    if (chrome?.storage?.sync) {
      const syncData = await chrome.storage.sync.get(['geminiFolders']);
      if (syncData.geminiFolders) {
        appState.folders = syncData.geminiFolders;
      } else if (chrome?.storage?.local) {
        const localData = await chrome.storage.local.get(['geminiFolders']);
        if (localData.geminiFolders) {
          appState.folders = localData.geminiFolders;
          chrome.storage.sync.set({ geminiFolders: appState.folders }).catch(() => {});
        }
      }
    } else if (chrome?.storage?.local) {
      const localData = await chrome.storage.local.get(['geminiFolders']);
      if (localData && localData.geminiFolders) {
        appState.folders = localData.geminiFolders;
      }
    }
  } catch (error) {
    console.warn("Storage error. Starting fresh.");
  }
  normalizeStateFolders();
  observeDOM();
}

function saveState() {
  if (chrome?.storage?.local) {
    chrome.storage.local.set({ geminiFolders: appState.folders }).catch(() => {});
  }
  if (chrome?.storage?.sync) {
    chrome.storage.sync.set({ geminiFolders: appState.folders }).catch(() => {});
  }
}

function observeDOM() {
  const syncSidebarUI = () => {
    const allChatLinks = Array.from(document.querySelectorAll('a[href*="/app/"]'));
    
    const sidebarLinks = allChatLinks.filter(link => {
      const rect = link.getBoundingClientRect();
      return rect.width > 0 && rect.left >= 0 && rect.left < 350; 
    });

    if (sidebarLinks.length > 0) {
      const firstLink = sidebarLinks[0];
      let listContainer = firstLink.parentElement;
      
      while (listContainer && listContainer.tagName !== 'BODY') {
        const childLinks = listContainer.querySelectorAll('a[href*="/app/"]');
        if (childLinks.length > 1 && listContainer.tagName !== 'A') {
            break; 
        }
        listContainer = listContainer.parentElement;
      }

      if (listContainer && !document.getElementById('gemini-organizer-root')) {
        injectUI(listContainer);
      } else if (listContainer) {
        ensureChatsHeaderButton();
        organizeChats();
      }
    }
  };

  const observer = new MutationObserver(() => {
    if (domSyncScheduled) {
      return;
    }

    domSyncScheduled = true;
    requestAnimationFrame(() => {
      domSyncScheduled = false;
      syncSidebarUI();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  syncSidebarUI();
}

function injectUI(listContainer) {
  const root = document.createElement('div');
  root.id = 'gemini-organizer-root';
  root.className = 'gemini-organizer-container';

  listContainer.prepend(root);

  setupMainListDropTarget(listContainer);
  ensureChatsHeaderButton();
  renderFolders();
}

function setupMainListDropTarget(listContainer) {
  if (!listContainer || listContainer.dataset.goMainDropReady === '1') {
    return;
  }

  listContainer.dataset.goMainDropReady = '1';

  listContainer.addEventListener('dragover', (e) => {
    if (e.target.closest('.go-folder')) {
      return;
    }

    e.preventDefault();
    const root = document.getElementById('gemini-organizer-root');
    if (root) {
      root.classList.add('go-main-drop-active');
    }
  });

  listContainer.addEventListener('dragleave', (e) => {
    const relatedTarget = e.relatedTarget;
    if (relatedTarget && listContainer.contains(relatedTarget)) {
      return;
    }

    const root = document.getElementById('gemini-organizer-root');
    if (root) {
      root.classList.remove('go-main-drop-active');
    }
  });

  listContainer.addEventListener('drop', (e) => {
    const root = document.getElementById('gemini-organizer-root');
    if (root) {
      root.classList.remove('go-main-drop-active');
    }

    if (e.target.closest('.go-folder')) {
      return;
    }

    const chatHref = e.dataTransfer.getData('text/plain');
    if (!chatHref) {
      return;
    }

    e.preventDefault();
    removeChatFromFolders(chatHref);
    saveState();
    renderFolders();
  });
}

function findChatsHeaderElement() {
  const textCandidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, span, p'));

  return textCandidates.find(el => {
    if (!el) {
      return false;
    }

    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 30) {
      return false;
    }

    return /^(Chats|Czaty)(\s*\(\d+\))?$/i.test(text);
  }) || null;
}

function ensureChatsHeaderButton() {
  const chatsHeader = findChatsHeaderElement();
  if (!chatsHeader || !chatsHeader.parentElement) {
    return;
  }

  let headerContainer = chatsHeader.parentElement;
  const parentRect = headerContainer.getBoundingClientRect();
  if (parentRect.height > 120) {
    headerContainer = chatsHeader;
  }

  headerContainer.classList.add('go-chats-header-anchor');

  const existingButton = document.getElementById('gemini-organizer-add-btn');
  if (existingButton && existingButton.parentElement === headerContainer) {
    return;
  }

  if (existingButton) {
    existingButton.remove();
  }

  const addBtn = document.createElement('button');
  addBtn.id = 'gemini-organizer-add-btn';
  addBtn.className = 'go-add-folder-icon';
  addBtn.type = 'button';
  addBtn.innerText = '+';
  addBtn.title = 'Create folder';
  addBtn.setAttribute('aria-label', 'Create folder');
  addBtn.onclick = createFolder;

  headerContainer.appendChild(addBtn);
}

function createFolder() {
  const newFolder = createFolderObject();
  appState.folders.push(newFolder);
  saveState();
  renderFolders();
}

function createSubFolder(parentFolder) {
  parentFolder.subfolders.push(createFolderObject('New Sub-folder'));
  parentFolder.isExpanded = true;
  saveState();
  renderFolders();
}

function renderFolders() {
  const root = document.getElementById('gemini-organizer-root');
  if (!root) return;

  const sidebarContainer = root.parentNode;
  const existingFolders = root.querySelectorAll('.go-folder');
  existingFolders.forEach(f => {
    const chatsInside = f.querySelectorAll('a[href*="/app/"]');
    chatsInside.forEach(chat => {
      sidebarContainer.appendChild(chat); 
    });
    f.remove();
  });

  renderFolderTree(appState.folders, root, 0);

  organizeChats();
}

function renderFolderTree(folders, parentElement, depth) {
  folders.forEach(folderData => {
    const folderEl = document.createElement('div');
    folderEl.className = `go-folder ${folderData.isExpanded ? 'expanded' : ''}`;
    folderEl.dataset.id = folderData.id;

    const header = document.createElement('div');
    header.className = 'go-folder-header';
    
    const chevron = document.createElement('div');
    chevron.className = 'go-folder-chevron';
    chevron.innerText = '▶'; 

    header.onclick = () => {
      folderData.isExpanded = !folderData.isExpanded;
      saveState();
      folderEl.classList.toggle('expanded');
    };

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'go-folder-color';
    colorPicker.value = folderData.color;

    const colorDot = document.createElement('button');
    colorDot.type = 'button';
    colorDot.className = 'go-folder-dot';
    colorDot.title = 'Change folder color';
    colorDot.style.backgroundColor = folderData.color;

    const colorWrap = document.createElement('div');
    colorWrap.className = 'go-folder-color-wrap';
    colorWrap.onclick = (e) => e.stopPropagation();

    colorPicker.onclick = (e) => e.stopPropagation();
    colorPicker.oninput = (e) => {
      folderData.color = e.target.value;
      colorDot.style.backgroundColor = folderData.color;
      saveState();
    };

    colorPicker.onchange = (e) => {
      folderData.color = e.target.value;
      colorDot.style.backgroundColor = folderData.color;
      saveState();
    };

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'go-folder-name';
    nameInput.value = folderData.name;
    nameInput.onclick = (e) => e.stopPropagation();
    nameInput.onchange = (e) => {
      folderData.name = e.target.value;
      saveState();
    };

    const delBtn = document.createElement('button');
    delBtn.innerText = '×';
    delBtn.className = 'go-folder-delete';
    delBtn.title = 'Delete folder';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Delete this folder? (Chats will return to the main list)')) {
        removeFolderById(folderData.id);
        saveState();
        renderFolders();
      }
    };

    const addSubBtn = document.createElement('button');
    addSubBtn.innerText = '+';
    addSubBtn.className = 'go-folder-add-sub';
    addSubBtn.title = 'Create sub-folder';
    addSubBtn.onclick = (e) => {
      e.stopPropagation();
      createSubFolder(folderData);
    };

    header.appendChild(chevron);
    colorWrap.appendChild(colorDot);
    colorWrap.appendChild(colorPicker);
    header.appendChild(colorWrap);
    header.appendChild(nameInput);
    header.appendChild(addSubBtn);
    header.appendChild(delBtn);

    const content = document.createElement('div');
    content.className = 'go-folder-content';

    const subfolders = document.createElement('div');
    subfolders.className = 'go-subfolders';
    
    setupDragAndDrop(folderEl, folderData, content);

    content.appendChild(subfolders);
    folderEl.appendChild(header);
    folderEl.appendChild(content);
    parentElement.appendChild(folderEl);

    if (folderData.subfolders.length > 0) {
      renderFolderTree(folderData.subfolders, subfolders, depth + 1);
    }
  });
}

function setupDragAndDrop(folderEl, folderData, content) {
  folderEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    folderEl.classList.add('drag-over');
  });

  folderEl.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    folderEl.classList.remove('drag-over');
  });

  folderEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    folderEl.classList.remove('drag-over');
    
    folderData.isExpanded = true; 
    
    const chatHref = e.dataTransfer.getData('text/plain');
    
    if (chatHref) {
      removeChatFromFolders(chatHref);
      
      if (!folderData.chats.includes(chatHref)) {
        folderData.chats.push(chatHref);
      }
      
      saveState();
      renderFolders(); 
    }
  });
}

function organizeChats() {
  const root = document.getElementById('gemini-organizer-root');
  if (!root) return;

  const chatLinks = document.querySelectorAll('a[href*="/app/"]');
  
  chatLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    link.draggable = true;
    link.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', href);
    };

    const targetFolder = findFolderContainingChat(href);
    
    if (targetFolder) {
      const folderContentArea = document.querySelector(`.go-folder[data-id="${targetFolder.id}"] .go-folder-content`);
      if (folderContentArea && link.parentElement !== folderContentArea) {
        folderContentArea.appendChild(link);
      }
    }
  });
}

init();