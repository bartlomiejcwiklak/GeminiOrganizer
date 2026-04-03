let appState = {
  folders: []
};

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
  const observer = new MutationObserver(() => {
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
        organizeChats();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function injectUI(listContainer) {
  const root = document.createElement('div');
  root.id = 'gemini-organizer-root';
  root.className = 'gemini-organizer-container';

  const addBtn = document.createElement('button');
  addBtn.innerText = '+ New Folder'; 
  addBtn.className = 'go-add-folder-btn';
  addBtn.onclick = createFolder;

  root.appendChild(addBtn);
  listContainer.prepend(root);

  renderFolders();
}

function createFolder() {
  const newFolder = {
    id: 'folder_' + Date.now(),
    name: 'New Folder',
    color: '#4285F4',
    isExpanded: true,
    chats: []
  };
  appState.folders.push(newFolder);
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

  appState.folders.forEach(folderData => {
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
    colorPicker.onclick = (e) => e.stopPropagation();
    colorPicker.onchange = (e) => {
      folderData.color = e.target.value;
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
        appState.folders = appState.folders.filter(f => f.id !== folderData.id);
        saveState();
        renderFolders();
      }
    };

    header.appendChild(chevron);
    header.appendChild(colorPicker);
    header.appendChild(nameInput);
    header.appendChild(delBtn);

    const content = document.createElement('div');
    content.className = 'go-folder-content';
    
    setupDragAndDrop(folderEl, folderData, content);

    folderEl.appendChild(header);
    folderEl.appendChild(content);
    root.appendChild(folderEl);
  });

  organizeChats();
}

function setupDragAndDrop(folderEl, folderData, content) {
  folderEl.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    folderEl.classList.add('drag-over');
  });

  folderEl.addEventListener('dragleave', () => {
    folderEl.classList.remove('drag-over');
  });

  folderEl.addEventListener('drop', (e) => {
    e.preventDefault();
    folderEl.classList.remove('drag-over');
    
    folderData.isExpanded = true; 
    
    const chatHref = e.dataTransfer.getData('text/plain');
    
    if (chatHref) {
      appState.folders.forEach(f => {
        f.chats = f.chats.filter(href => href !== chatHref);
      });
      
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

    const targetFolder = appState.folders.find(f => f.chats.includes(href));
    
    if (targetFolder) {
      const folderContentArea = document.querySelector(`.go-folder[data-id="${targetFolder.id}"] .go-folder-content`);
      if (folderContentArea && link.parentElement !== folderContentArea) {
        folderContentArea.appendChild(link);
      }
    }
  });
}

init();