document.addEventListener('DOMContentLoaded', () => {
  const WEBSERVER = 'https://emreview.duckdns.org/api/noteapp';
  const STATIC_REPOSITORY = 'https://tranvnthuong.github.io/noteapp';

  let db;
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NotesApp', 1);

      request.onupgradeneeded = function (event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('date', 'isoDate', { unique: false });
          store.createIndex('title', 'titleText', { unique: false });
          store.createIndex('content', 'textContent', { unique: false });
        }
      };

      request.onsuccess = function (event) {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = function () {
        reject('Failed to open IndexedDB.');
      };
    });
  }

  let sortNotesBy;
  async function init() {
    try {
      db = await openDatabase();

      let sortNote = localStorage.getItem('sortby') ?? 'title';

      document
        .getElementById('sortNotes')
        .querySelectorAll('option')
        .forEach((element) => {
          if (element.value === sortNote)
            element.setAttribute('selected', true);
        });

      sortNotesBy = sortNote;

      displayNotes(sortNotesBy);

      getNoteInUrlParameter();
    } catch (error) {
      console.error(error);
    }
  }

  init();

  let translations = {};
  async function fetchLanguageData(language) {
    try {
      const response = await fetch(`./assets/en-vi.json`);
      if (!response.ok) throw new Error('Language file not found');
      let languageJson = await response.json();
      return languageJson[language];
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  async function updateLanguageHtml(language) {
    const elementsWithDataKey = document.querySelectorAll(
      '[data-i18n]:not(input):not(button:not(#multiSelect))'
    );
    const inputsWithDataKey = document.querySelectorAll('input[data-i18n]');
    const buttonsWithDataKey = document.querySelectorAll('button[data-i18n]');

    translations = await fetchLanguageData(language);
    elementsWithDataKey.forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (translations[key]) {
        element.textContent = translations[key];
      }
    });

    inputsWithDataKey.forEach((input) => {
      const key = input.getAttribute('data-i18n');
      if (translations[key]) {
        input.placeholder = translations[key];
      }
    });

    buttonsWithDataKey.forEach((button) => {
      const key = button.getAttribute('data-i18n');
      if (translations[key]) {
        button.title = translations[key];
      }
    });
    reloadToolTips();
  }

  document
    .getElementById('languageSelect')
    .addEventListener('change', (event) => {
      const language = event.target.value;
      localStorage.setItem('use-language', language);
      updateLanguageHtml(language);
    });

  document.getElementById('plus').addEventListener('click', (e) => {
    const ul = document.getElementById('ul');
    if (ul.classList.contains('animate')) {
      ul.classList.remove('animate');
      ul.classList.add('hiding');
    } else {
      ul.classList.remove('hiding');
      ul.classList.add('animate');
    }
  });

  (async function () {
    let useLanguage = localStorage.getItem('use-language');
    if (useLanguage) {
      translations = await fetchLanguageData(useLanguage);
      document
        .getElementById('languageSelect')
        .querySelectorAll('option')
        .forEach((opt) => {
          if (opt.value === useLanguage) opt.setAttribute('selected', true);
        });
      updateLanguageHtml(useLanguage);
    } else {
      translations = await fetchLanguageData('vi');
    }
  })('loadlanguage');

  function putNoteWithoutWait(note) {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    store.put(note);
    transaction.oncomplete = function () {
      displayNotes(sortNotesBy);
    };
  }

  function getNote(id) {
    return new Promise((resolve) => {
      const transaction = db.transaction('notes', 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.get(id);
      request.onsuccess = (event) => {
        const note = event.target.result;
        if (note) {
          resolve({
            found: true,
            message: 'Found a note',
            data: note,
          });
        } else {
          resolve({
            found: false,
            message: 'Note not found',
          });
        }
      };
    });
  }

  async function getNoteInUrlParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = parseInt(urlParams.get('note'), 10);
    if (id) {
      urlParams.delete('note');
      history.pushState({}, '', window.location.pathname);
      const note = await getNote(id);
      if (note.found) {
        showNote(id);
      } else {
        try {
          const response = await fetch(`${WEBSERVER}/api/notes/${id}`);
          if (response.ok) {
            let data = await response.json();
            const transaction = db.transaction('notes', 'readwrite');
            const store = transaction.objectStore('notes');
            store.put(data.note);

            transaction.oncomplete = function () {
              displayNotes(sortNotesBy);
              showNote(data.note.id);
            };
          } else {
            let data = await response.json();
            Swal.fire({
              icon: 'error',
              title: translations.get_note_failed,
              text: data.message,
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: translations.an_error,
            text: `${translations.error_details} ${error}`,
          });
        }
      }
    }
  }

  document.getElementById('sortNotes').addEventListener('change', (e) => {
    let value = e.target.value;
    localStorage.setItem('sortby', value);
    sortNotesBy = value;
    displayNotes(value);
  });

  function displayNotes(sortBy = 'title') {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    //console.log("existing index names in store", store.indexNames);
    const index = store.index(sortBy);

    const request = index.getAll();

    request.onsuccess = function () {
      const notes = request.result;
      const noteList = document.querySelector('.notes-list .note-container');
      noteList.innerHTML = '';
      if (notes.length == 0) {
        document.querySelector('.empty-note').classList.remove('d-none');
        document.querySelector('.notes-toolbar').classList.add('d-none');
        return;
      }
      document.querySelector('.empty-note').classList.add('d-none');
      document.querySelector('.notes-toolbar').classList.remove('d-none');
      notes.forEach((note) => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-element col-6 col-md-4 col-lg-3';
        noteElement.setAttribute('data-note-id', note.id);
        noteElement.innerHTML = `<input class="note-checkbox" id="note${note.id}" value="${note.id}" type="checkbox">
                    <div class="card" onclick="showNote(${note.id})">
                    <div class="card-body">
                        <h5 class="card-title">${note.titleText}</h5>
                        <div class="card-text">${note.textContent}</div>
                        <div class="d-flex justify-content-between align-items-center mt-2 mb-0">
                            <p class="text-muted small mb-0">${note.dateString}</p>
                            <button
                              class="btn btn-danger btn-sm"
                              onclick="deleteNote(${note.id}, event)"
                            >
                              <i class="fa fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        noteList.appendChild(noteElement);
      });
      if (showCheckbox) {
        document.getElementById('multiSelect').click();
      }
    };
  }

  const reloadToolTips = () => {
    if (window.matchMedia('(hover: none)').matches) {
      return;
    }
    let tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-toggle="tooltip"]')
    );
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
      let tooltip = new bootstrap.Tooltip(tooltipTriggerEl);
      let timer;
      tooltipTriggerEl.addEventListener('mouseenter', () => {
        tooltip.show();
        timer = setTimeout(() => tooltip.hide(), 1500);
      });

      tooltipTriggerEl.addEventListener('mouseleave', () => {
        clearTimeout(timer);
        tooltip.hide();
      });
    });
  };

  const Toast = Swal.mixin({
    toast: true,
    position: 'top',
    customClass: {
      popup: 'colored-toast',
    },
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: false,
  });

  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }

  function throttle(func, interval) {
    let lastTime = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastTime >= interval) {
        lastTime = now;
        func.apply(this, args);
      }
    };
  }

  let clearSearchBtn = document.getElementById('clearSearch');
  clearSearchBtn.onclick = function () {
    document.getElementById('searchInput').value = '';
    clearSearchBtn.style.opacity = '0';
    clearSearchBtn.style.pointerEvents = 'none';
    document
      .querySelectorAll('[data-note-id]')
      .forEach((e) => e.classList.remove('d-none'));
    let searchInNote = document.querySelector('.show-note');
    if (searchInNote) {
      resetHighlight(searchInNote.querySelector('div'));
    }
  };

  function resetHighlight(container) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ALL,
      null,
      false
    );

    while (walker.nextNode()) {
      const currentNode = walker.currentNode;

      if (currentNode.tagName === 'MARK') {
        const textNode = document.createTextNode(currentNode.textContent);
        currentNode.parentNode.replaceChild(textNode, currentNode);
      }
    }
  }

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      let searchInNote = document.querySelector('.show-note');

      if (e.target.value.trim() === '') {
        clearSearchBtn.style.opacity = '0';
        clearSearchBtn.style.pointerEvents = 'none';
        if (searchInNote.querySelector('.ql-container .ql-editor').innerHTML) {
          resetHighlight(searchInNote.querySelector('div'));
        } else {
          document
            .querySelectorAll('[data-note-id]')
            .forEach((e) => e.classList.remove('d-none'));
        }
        return;
      }
      clearSearchBtn.style.opacity = '1';
      clearSearchBtn.style.pointerEvents = 'all';

      let query = e.target.value;

      if (searchInNote.querySelector('.ql-container .ql-editor').innerHTML) {
        let container = searchInNote.querySelector('div');
        resetHighlight(container);

        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        while (walker.nextNode()) {
          const currentNode = walker.currentNode;
          if (
            currentNode.nodeValue.toLowerCase().includes(query.toLowerCase())
          ) {
            const matchedText = currentNode.nodeValue;

            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedText = matchedText.replace(
              regex,
              '<mark>$1</mark>'
            );

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = highlightedText;

            while (tempDiv.firstChild) {
              currentNode.parentNode.insertBefore(
                tempDiv.firstChild,
                currentNode
              );
            }

            currentNode.parentNode.removeChild(currentNode);
          }
        }

        const firstMatch = container.querySelector('mark');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        const transaction = db.transaction('notes', 'readonly');
        const store = transaction.objectStore('notes');
        const request = store.getAll();
        request.onsuccess = function (event) {
          const notes = event.target.result;
          notes.forEach((note) => {
            let title = note.titleText.toLowerCase();
            let text = note.textContent.toLowerCase();

            if (!text.includes(query) && !title.includes(query)) {
              document
                .querySelector(`div[data-note-id="${note.id}"]`)
                .classList.add('d-none');
            } else {
              document
                .querySelector(`div[data-note-id="${note.id}"]`)
                .classList.remove('d-none');
            }
          });
        };
      }
    }, 1000)
  );

  let quill;
  document.getElementById('quilljs').addEventListener(
    'scroll',
    throttle((e) => {
      const toolbar = document.querySelector('#quilljs .ql-toolbar');
      const containerRect = document
        .querySelector('#quilljs')
        .getBoundingClientRect();
      const elementRect = toolbar.getBoundingClientRect();
      if (elementRect.top < containerRect.top) {
        toolbar.style.position = 'fixed';
        toolbar.style.top = '0';
        toolbar.style.width = '80%';
        toolbar.style.zIndex = '10';
        toolbar.style.backgroundColor = '#f1f1f1';
      } else {
        toolbar.style.position = 'relative';
        toolbar.style.top = 'auto';
        toolbar.style.background = 'none';
      }
    }, 200)
  );

  const toolbarOptions = [
    [{ header: [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['blockquote', 'code-block'],
    [{ align: [] }],
  ];

  document.getElementById('closePopup').addEventListener('click', () => {
    const popup = document.getElementById('popup');
    popup.classList.remove('show');
    popup.classList.add('hide');
    document.getElementById('updateNote').style.display = 'none';
    document.getElementById('popupHeader').textContent = 'Ghi chú mới';
  });

  window.showNote = function (id) {
    let noteList = document.querySelector('.notes-list');
    noteList.style.overflowY = 'hidden';
    noteList.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    clearSearchBtn.click();
    document
      .getElementById('searchInput')
      .setAttribute('placeholder', translations.search_in_note);

    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.get(id);

    request.onsuccess = function (event) {
      const note = event.target.result;
      const showNote = document.querySelector('.notes-list .show-note');
      showNote.classList.remove('d-none');
      showNote.querySelector('.updated').textContent = note.dateString;
      showNote.querySelector('.ql-container .ql-editor').innerHTML =
        note.content;

      document.getElementById('shareNote').onclick = function (event) {
        shareNote(note.id, event.target);
      };
      document.getElementById('showEdit').onclick = function () {
        editNote(note.id);
      };
      document.getElementById('showDelete').onclick = function () {
        document.querySelector('.notes-list').style = '';
        document
          .getElementById('searchInput')
          .setAttribute('placeholder', translations.placeholder_search);
        showNote.querySelector('.ql-container .ql-editor').innerHTML = '';
        showNote.classList.add('d-none');
        deleteNote(note.id);
      };
      document.getElementById('closeShow').onclick = function () {
        document.querySelector('.notes-list').style = '';
        document
          .getElementById('searchInput')
          .setAttribute('placeholder', translations.placeholder_search);
        showNote.querySelector('.ql-container .ql-editor').innerHTML = '';
        showNote.classList.add('d-none');
      };

      const qlCodeBlockContainers = noteList
        .querySelector('.ql-container')
        .querySelector('.ql-editor')
        .querySelectorAll('.ql-code-block-container');

      qlCodeBlockContainers.forEach((qlCodeBlockContainer) => {
        qlCodeBlockContainer.className = 'highlight-code-container';
        const codeText = qlCodeBlockContainer.innerText
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        qlCodeBlockContainer.innerHTML = `
      <div class="code-language">
        <i class="fa-solid fa-code"></i>
        <p></p>
      </div>
      <button class="copy-btn">Copy</button>
      <pre><code>
        ${codeText}
      </code></pre>
      `;
        const codeContainer = qlCodeBlockContainer.querySelector('pre code');
        hljs.highlightElement(codeContainer);
        qlCodeBlockContainer.style.whiteSpace = 'nowrap';
        qlCodeBlockContainer.style.fontSize = 'initial';
        qlCodeBlockContainer.style.lineHeight = 'initial';

        const languageCode = codeContainer.className.replace(
          'hljs language-',
          ''
        );

        if (languageCode !== 'undefined') {
          qlCodeBlockContainer
            .querySelector('.code-language')
            .querySelector('p').textContent = languageCode;
        }

        document.querySelectorAll('.copy-btn').forEach((button) => {
          button.addEventListener('click', () => {
            const codeBlock = button.nextElementSibling.querySelector('code');
            const codeText = codeBlock.innerText;

            navigator.clipboard
              .writeText(codeText)
              .then(() => {
                button.innerText = 'Copied!';
                setTimeout(() => {
                  button.innerText = 'Copy';
                }, 2000);
              })
              .catch((err) => {
                console.error('Error copying text: ', err);
              });
          });
        });
      });
    };
  };

  window.editNote = function (id) {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.get(id);

    request.onsuccess = function (event) {
      const note = event.target.result;
      const popup = document.getElementById('popup');
      if (popup.classList.contains('show')) {
        return;
      }
      document.getElementById('quilljs').innerHTML = '<div id="editor"></div>';
      popup.classList.remove('hide');
      popup.classList.add('show');
      quill = new Quill('#editor', {
        modules: {
          toolbar: toolbarOptions,
        },
        theme: 'snow',
      });
      quill.clipboard.dangerouslyPasteHTML(note.content);
      document.getElementById('popupHeader').textContent =
        translations.edit_note;
      document.getElementById('addAndShare').style.display = 'none';
      const updateButton = document.getElementById('updateNote');
      updateButton.style.display = 'initial';
      updateButton.onclick = function () {
        updateNote(id);
        showNote(id);
      };
    };
  };

  window.updateNote = function (id) {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.get(id);
    request.onsuccess = function (event) {
      const { shared } = event.target.result;

      let content = quill.root.innerHTML;
      let parser = new DOMParser();
      let doc = parser.parseFromString(content, 'text/html');

      let titleElement =
        doc.querySelector('h1') ||
        doc.querySelector('h2') ||
        doc.querySelector('h3') ||
        doc.querySelector('h4');
      let titleText, titleHTML;

      if (titleElement) {
        titleText = titleElement.textContent;
        titleHTML = titleElement.outerHTML;
        titleElement.remove();
      }

      let textContent = doc.body.innerText;

      let date = new Date();
      let formattedDate = date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const note = {
        id,
        titleText: titleText,
        title: titleHTML,
        textContent: textContent,
        content: content,
        dateString: formattedDate,
        isoDate: date,
        shared,
      };

      store.put(note);
      transaction.oncomplete = function () {
        document.getElementById('updateNote').style.display = 'none';
        document.getElementById('popupHeader').textContent =
          translations.new_note;
        document.getElementById('closePopup').click();
        displayNotes(sortNotesBy);
      };
    };
  };

  let warning = true;
  window.deleteNote = function (id, event = null) {
    if (event) {
      event.stopPropagation();
    }
    const deletionWarning = new Promise((resolve) => {
      if (warning) {
        Swal.fire({
          icon: 'warning',
          text: translations.Confirm_note_deletion,
          input: 'checkbox',
          inputPlaceholder: translations.do_not_repeat,
          showCancelButton: true,
          cancelButtonText: translations.cancel,
          confirmButtonText: translations.delete,
        }).then((result) => {
          if (result.isConfirmed) {
            if (result.value) {
              warning = false;
            }
            resolve(true);
          } else {
            resolve(false);
          }
        });
      } else {
        resolve(true);
      }
    });
    deletionWarning.then((remove) => {
      if (remove) {
        const transaction = db.transaction('notes', 'readwrite');
        const store = transaction.objectStore('notes');
        store.delete(id);

        transaction.oncomplete = function () {
          displayNotes(sortNotesBy);
        };

        transaction.onerror = function () {
          console.error('Failed to delete note.');
        };
      }
    });
  };

  function deleteNoteIdb(id) {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    store.delete(id);

    transaction.oncomplete = function () {
      displayNotes(sortNotesBy);
    };

    transaction.onerror = function () {
      console.error('Failed to delete note.');
    };
  }

  function createModalController(modalId) {
    const modalElement = document.getElementById(modalId);

    let modalInstance =
      bootstrap.Modal.getInstance(modalElement) ||
      new bootstrap.Modal(modalElement);

    return {
      show() {
        modalInstance.show();
      },
      hide() {
        modalInstance.hide();
      },
    };
  }

  function sharingModalContainer(idElement) {
    const listIdContainers = [
      'verifySharing',
      'shareWithId',
      'sharePopup',
      'qrLayout',
    ];
    listIdContainers.forEach((ContainerId) => {
      if (idElement === ContainerId) {
        if (idElement == listIdContainers[2]) {
          document.getElementById('idNote').textContent =
            shareNotes.getIdNote();
          document.getElementById(
            'linkInput'
          ).value = `${STATIC_REPOSITORY}?note=${shareNotes.getIdNote()}`;
        } else if (
          idElement == listIdContainers[0] ||
          idElement == listIdContainers[1]
        ) {
          document
            .getElementById(idElement)
            .querySelectorAll('input')
            .forEach((ipEl) => (ipEl.value = ''));
        }
        if (ContainerId == listIdContainers[3]) {
          document.getElementById('qrOutput').innerHTML = '';
        }
        document.getElementById(idElement).classList.remove('d-none');
      } else {
        document.getElementById(ContainerId).classList.add('d-none');
      }
    });
  }

  function loadingIconButton(btn) {
    const loadingIcon = '<i class="fa-solid fa-spinner fa-spin-pulse"></i>';
    const originIcon = btn.innerHTML;
    return {
      show() {
        btn.innerHTML = loadingIcon;
      },
      hide() {
        btn.innerHTML = originIcon;
      },
    };
  }

  function loadingCircleButton(btn) {
    const rect = btn.getBoundingClientRect();

    const spinner = document.createElement('div');
    spinner.className = 'spinner-border text-info';
    spinner.style.position = 'absolute';
    spinner.style.width = `${rect.width + 5}px`;
    spinner.style.height = `${rect.width + 5}px`;
    spinner.style.top = `${rect.top + window.scrollY - 2.5}px`;
    spinner.style.left = `${rect.left + window.scrollX - 2.5}px`;
    spinner.style.zIndex = '1000';

    // Tạo container cho spinner nếu cần
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '999';
    overlay.style.pointerEvents = 'none';
    overlay.appendChild(spinner);

    document.body.appendChild(overlay);

    return {
      show() {
        overlay.style.display = 'block';
        btn.disabled = true;
      },
      hide() {
        overlay.style.display = 'none';
        btn.disabled = false;
        document.body.removeChild(overlay);
      },
    };
  }

  async function getCaptcha() {
    try {
      let response = await fetch(
        `${WEBSERVER}/api/notes/get-verification-code`
      );
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      let data = await response.json();
      return { ok: true, data: data };
    } catch (error) {
      return { ok: false, status: error };
    }
  }

  const shareNotes = (function () {
    let captcha = {
      captcha: '',
      expired: Date.now(),
    };
    let idNote;
    return {
      putCaptcha(c) {
        captcha = c;
      },
      getCaptcha() {
        return captcha;
      },
      putIdNote(i) {
        idNote = i;
      },
      getIdNote() {
        return idNote;
      },
    };
  })();

  let blockSpam = false;

  document.querySelectorAll('#refreshCaptcha').forEach((element) => {
    element.addEventListener('click', async (event) => {
      let loadingIcon = loadingIconButton(event.target);
      loadingIcon.show();
      if (blockSpam) {
        Toast.fire({
          icon: 'warning',
          title: translations.wait_a_few_second,
        });
        loadingIcon.hide();
        return;
      }
      blockSpam = true;
      try {
        let request = await getCaptcha();
        if (request.ok) {
          let verificationCode = request.data.data;
          shareNotes.putCaptcha(verificationCode);
          document.getElementById('cacha').textContent =
            verificationCode.captcha;
          document.getElementById('cacha2').textContent =
            verificationCode.captcha;
        } else {
          Swal.fire({
            icon: 'error',
            title: translations.sharing_error,
            text: `${translations.error_details} ${request.status}`,
          });
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: translations.an_error,
          text: `${translations.error_details} ${error}`,
        });
      }
      loadingIcon.hide();
      setTimeout(() => (blockSpam = false), 5000);
    });
  });

  function validateCaptcha(captchaInput) {
    if (captchaInput.value.trim() === '') {
      Toast.fire({
        icon: 'warning',
        title: translations.captcha_require,
      });
      return false;
    }
    if (captchaInput.value.toLowerCase() !== shareNotes.getCaptcha().captcha) {
      Toast.fire({
        icon: 'error',
        title: translations.wrong_captcha,
      });
      return false;
    }
    if (shareNotes.getCaptcha().expired < Date.now()) {
      Toast.fire({
        icon: 'error',
        title: translations.captcha_has_expired,
      });
      return false;
    }
    return true;
  }

  let blockSubmit = false;
  document
    .getElementById('submitSharing')
    .addEventListener('click', (event) => {
      const captchaInput = document.getElementById('cachaIput');
      if (!validateCaptcha(captchaInput)) {
        return;
      }
      let loadingIcon = loadingIconButton(event.target);
      loadingIcon.show();
      if (blockSubmit) {
        Toast.fire({
          icon: 'warning',
          title: translations.wait_for_response,
        });
        loadingIcon.hide();
        return;
      }
      blockSubmit = true;
      let transaction = db.transaction('notes', 'readonly');
      let store = transaction.objectStore('notes');
      let request = store.get(shareNotes.getIdNote());

      request.onsuccess = async function (event) {
        const note = event.target.result;
        try {
          let response = await fetch(`${WEBSERVER}/api/notes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Captcha: captchaInput.value,
            },
            body: JSON.stringify(note),
          });
          if (response.ok) {
            let data = await response.json();
            transaction = db.transaction('notes', 'readwrite');
            store = transaction.objectStore('notes');
            store.put(data.note);
            transaction.oncomplete = function () {
              sharingModalContainer('sharePopup');
            };
          } else {
            let data = await response.json();
            Swal.fire({
              icon: 'error',
              title: translations.sharing_error,
              text: `${translations.error_details} ${data.message}`,
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: translations.an_error,
            text: `${translations.error_details} ${error}`,
          });
        }
        loadingIcon.hide();
        setTimeout(() => (blockSubmit = false), 5000);
      };
    });

  window.shareNote = function (id, btnEl) {
    const transaction = db.transaction('notes', 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.get(id);

    request.onsuccess = async function (event) {
      const note = event.target.result;
      shareNotes.putIdNote(id);
      if (note.shared) {
        sharingModalContainer('sharePopup');
        createModalController('shareModal').show();
      } else {
        if (blockSpam) {
          Toast.fire({
            icon: 'warning',
            title: translations.wait_a_few_second,
          });
          return;
        }
        blockSpam = true;
        sharingModalContainer('verifySharing');
        const loadingEffect = loadingCircleButton(btnEl);
        loadingEffect.show();
        try {
          let request = await getCaptcha();
          if (request.ok) {
            let verificationCode = request.data.data;
            shareNotes.putCaptcha(verificationCode);
            document.getElementById('cacha').textContent =
              verificationCode.captcha;
            createModalController('shareModal').show();
          } else {
            Swal.fire({
              icon: 'error',
              title: translations.sharing_error,
              text: `${translations.error_details} ${request.status}`,
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: translations.an_error,
            text: `${translations.error_details} ${error}`,
          });
        }
        loadingEffect.hide();
        setTimeout(() => (blockSpam = false), 5000);
      }
    };
  };

  window.copyLink = function () {
    let copyText = document.getElementById('linkInput');
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    Toast.fire({
      icon: 'success',
      title: translations.link_copied,
    });
  };

  window.downloadNote = async function () {
    const listNotes = [];
    const note = await getNote(shareNotes.getIdNote());
    if (note.found) {
      listNotes.push(note.data);
      const jsonData = JSON.stringify(listNotes, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = note.data.titleText + '.json';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }
  };

  window.createQRLink = function () {
    let qrOutput = document.getElementById('qrOutput');
    if (!qrOutput.innerHTML) {
      qrOutput.innerHTML = '';
      let qrcode = new QRCode(qrOutput, {
        text: document.getElementById('linkInput').value,
        width: 200,
        height: 200,
        colorDark: '#000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });
      document.getElementById('qrLayout').classList.remove('d-none');
    } else {
      qrOutput.innerHTML = '';
      document.getElementById('qrLayout').classList.add('d-none');
    }
  };

  let importModal;
  let informationModal;

  let _emptynote = true;
  window.sidebar = function (mode) {
    const popup = document.getElementById('popup');
    switch (mode) {
      case 'newNote':
        if (popup.classList.contains('show')) {
          return;
        }
        document.getElementById('addAndShare').style.display = 'initial';
        document.getElementById('quilljs').innerHTML =
          '<div id="editor"></div>';
        popup.classList.remove('hide');
        popup.classList.add('show');
        _emptynote = true;
        quill = new Quill('#editor', {
          modules: {
            toolbar: toolbarOptions,
          },
          theme: 'snow',
        });
        quill.clipboard.dangerouslyPasteHTML(
          `<h1>${translations.title}</h1><p>${translations.content}</p>`
        );
        quill.on('text-change', () => {
          let currentText = quill.getText().trim();
          _emptynote = currentText === '';
        });
        break;
      case 'useCode':
        Swal.fire({
          title: translations.enter_note_code,
          input: 'text',
          inputPlaceholder: translations.code_placeholder,
          inputAttributes: {
            autocapitalize: 'off',
            autocomplete: 'off',
          },
          showCancelButton: true,
          cancelButtonText: translations.cancel,
          confirmButtonText: translations.search,
          showLoaderOnConfirm: true,
          preConfirm: async (id) => {
            if (id.trim() === '') {
              return Swal.showValidationMessage(translations.note_code_require);
            } else if (!id.match(/^\d{6}$/)) {
              return Swal.showValidationMessage(
                translations.six_numbers_require
              );
            }
            id = parseInt(id, 10);
            const transaction = db.transaction('notes', 'readonly');
            const store = transaction.objectStore('notes');
            const request = store.get(id);
            let noteData;
            const findNote = new Promise((resolve) => {
              request.onsuccess = (event) => {
                noteData = event.target.result;
                if (noteData) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              };
            });
            let found = await findNote;
            if (found) {
              return { message: 'Found a note', note: noteData };
            } else {
              try {
                const response = await fetch(`${WEBSERVER}/api/notes/${id}
              `);
                if (!response.ok) {
                  let data = await response.json();
                  return Swal.showValidationMessage(`
                  ${data.message}
                `);
                }
                return response.json();
              } catch (error) {
                Swal.showValidationMessage(`
                Request failed: ${error}
              `);
              }
            }
          },
          allowOutsideClick: () => !Swal.isLoading(),
        }).then((result) => {
          if (result.isConfirmed) {
            Toast.fire({
              icon: 'success',
              title: translations.get_note_success,
            });
            const transaction = db.transaction('notes', 'readwrite');
            const store = transaction.objectStore('notes');
            store.put(result.value.note);

            transaction.oncomplete = function () {
              displayNotes(sortNotesBy);
              showNote(result.value.note.id);
            };
          }
        });
        break;
      case 'importFile':
        importModal = createModalController('importModal');
        importModal.show();
        break;
      case 'language':
        document.getElementById('webInformation').classList.add('d-none');
        document.getElementById('selectLanguage').classList.remove('d-none');
        informationModal = createModalController('informationModal');
        informationModal.show();
        break;
      case 'info':
        document.getElementById('webInformation').classList.remove('d-none');
        document.getElementById('selectLanguage').classList.add('d-none');
        informationModal = createModalController('informationModal');
        informationModal.show();
        break;
    }
  };

  document
    .getElementById('importfiles')
    .addEventListener('change', function (event) {
      const file = event.target.files[0];
      if (file) {
        if (file.type !== 'application/json') {
          Swal.fire({
            icon: 'error',
            title: translations.import_failed,
            text: translations.json_format_require,
          });
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const jsonData = JSON.parse(e.target.result);
            jsonData.forEach((note) => putNoteWithoutWait(note));
            Swal.fire({
              icon: 'success',
              title: translations.success,
              text: `${translations.import_text_1} (${jsonData.length} ${translations.import_text_2})`,
            });
            importModal.hide();
          } catch (error) {
            Swal.fire({
              icon: 'error',
              title: translations.import_error,
              text: error.message,
            });
          }
        };
        reader.readAsText(file);
      }
    });

  function newNote(id = null) {
    return new Promise((resolve, reject) => {
      if (_emptynote) return;

      let content = quill.root.innerHTML;
      let parser = new DOMParser();
      let doc = parser.parseFromString(content, 'text/html');
      let titleElement =
        doc.querySelector('h1') ||
        doc.querySelector('h2') ||
        doc.querySelector('h3') ||
        doc.querySelector('h4');
      let titleText, titleHTML;

      if (titleElement) {
        titleText = titleElement.innerText;
        titleHTML = titleElement.outerHTML;
        titleElement.remove();
      }

      let textContent = doc.body.innerText;

      let date = new Date();
      let formattedDate = date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      id = id ?? Math.floor(Math.random() * (999999 - 100000)) + 100000;

      const notes = {
        id: id,
        titleText: titleText,
        title: titleHTML,
        textContent: textContent,
        content: content,
        dateString: formattedDate,
        isoDate: date,
        shared: false,
      };

      const transaction = db.transaction('notes', 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.get(id);

      request.onsuccess = (event) => {
        const note = event.target.result;
        if (!note) {
          shareNotes.putIdNote(id);
          store.add(notes);
          displayNotes(sortNotesBy);
          resolve({
            success: true,
            message: 'New note created successfully',
            data: notes,
          });
        } else {
          resolve({
            success: false,
            message: 'ID already existsy',
          });
        }
      };

      transaction.onerror = function (err) {
        console.error('Failed to add note.');
        reject(err);
      };
      document.getElementById('closePopup').click();
    });
  }

  let _blockSubmit = false;
  document
    .getElementById('addAndShare')
    .addEventListener('click', async (event) => {
      if (_emptynote) return;
      n;
      const btnEl = event.target;
      if (blockSpam) {
        Toast.fire({
          icon: 'warning',
          title: translations.wait_a_few_second,
        });
        return;
      }
      blockSpam = true;
      sharingModalContainer('shareWithId');
      const loadingEffect = loadingCircleButton(btnEl);
      loadingEffect.show();
      try {
        let request = await getCaptcha();
        if (request.ok) {
          let verificationCode = request.data.data;
          shareNotes.putCaptcha(verificationCode);
          document.getElementById('cacha2').textContent =
            verificationCode.captcha;
          createModalController('shareModal').show();
          document.getElementById('submitSharing2').onclick = async function (
            event
          ) {
            let id = document.getElementById('idNoteInput').value;
            if (id.length > 1 && id.length !== 6 && !id.match(/^\d*$/)) {
              Toast.fire({
                icon: 'warning',
                title: translations.id_require_options,
              });
              return;
            } else if (id.match(/^\d{6}$/)) {
              id = parseInt(id, 10);
            } else if (id.trim() === '') {
              id = null;
            }
            const captchaInput = document.getElementById('cachaIput2');
            if (!validateCaptcha(captchaInput)) {
              return;
            }
            let loadingIcon = loadingIconButton(event.target);
            loadingIcon.show();
            if (_blockSubmit) {
              Toast.fire({
                icon: 'warning',
                title: translations.wait_for_response,
              });
              loadingIcon.hide();
              return;
            }
            _blockSubmit = true;
            const newnote = await newNote(id);
            if (!newnote.success) {
              Toast.fire({
                icon: 'error',
                title: newnote.message,
              });
            } else {
              const response = await fetch(`${WEBSERVER}/api/notes`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  captcha: captchaInput.value,
                },
                body: JSON.stringify(newnote.data),
              });
              if (response.ok) {
                let data = await response.json();
                putNoteWithoutWait(data.note);
                sharingModalContainer('sharePopup');
                createModalController('shareModal').show();
              } else {
                let data = await response.json();
                Swal.fire({
                  icon: 'error',
                  title: translations.sharing_error,
                  text: data.message,
                });
                deleteNoteIdb(newnote.data.id);
              }
            }
            loadingIcon.hide();
            setTimeout(() => (_blockSubmit = false), 5000);
          };
        } else {
          Swal.fire({
            icon: 'error',
            title: translations.sharing_error,
            text: `${translations.error_details} ${request.status}`,
          });
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: translations.an_error,
          text: `${translations.error_details} ${error}`,
        });
      }
      loadingEffect.hide();
      setTimeout(() => (blockSpam = false), 5000);
    });

  document.getElementById('addNote').addEventListener('click', () => {
    try {
      newNote();
    } catch (err) {
      console.error(err);
    }
  });

  function updateToggleSelectAllButton() {
    const itemCheckboxes = document.querySelectorAll('.note-checkbox');
    const allChecked = Array.from(itemCheckboxes).every(
      (checkbox) => checkbox.checked
    );
    document.getElementById('selectAll').innerHTML = allChecked
      ? '<i class="fa-regular fa-circle-check"></i>'
      : '<i class="fa-solid fa-circle-check"></i>';
  }

  function updateActionButtons() {
    const itemCheckboxes = document.querySelectorAll('.note-checkbox');
    const actionButtons = [
      document.getElementById('downloadSelected'),
      document.getElementById('deleteSelected'),
    ];
    const anyChecked = Array.from(itemCheckboxes).some(
      (checkbox) => checkbox.checked
    );
    actionButtons.forEach((button) => (button.disabled = !anyChecked));
  }

  document.getElementById('selectAll').addEventListener('click', (event) => {
    const itemCheckboxes = document.querySelectorAll('.note-checkbox');

    const allChecked = Array.from(itemCheckboxes).every(
      (checkbox) => checkbox.checked
    );
    itemCheckboxes.forEach((checkbox) => (checkbox.checked = !allChecked));
    updateActionButtons();
    updateToggleSelectAllButton();
  });

  document
    .getElementById('downloadSelected')
    .addEventListener('click', async (event) => {
      const itemDownloads = Array.from(
        document.querySelectorAll('.note-checkbox')
      ).filter((checkbox) => checkbox.checked);

      const listData = await Promise.all(
        itemDownloads.map(async (checkbox) => {
          const note = await getNote(parseInt(checkbox.value, 10));
          return note.data;
        })
      );
      if (listData.length > 0) {
        const jsonData = JSON.stringify(listData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-notes[length=${listData.length}].json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
      }
    });

  document.getElementById('deleteSelected').addEventListener('click', () => {
    const itemCheckboxes = document.querySelectorAll('.note-checkbox');
    const lengthChecked = Array.from(itemCheckboxes).filter(
      (checkbox) => checkbox.checked
    ).length;
    const text =
      itemCheckboxes.length == lengthChecked
        ? translations.delete_text
        : lengthChecked;

    Swal.fire({
      icon: 'warning',
      title: translations.delete_warning,
      text: `${translations.delete_warning_1} ${text} ${translations.delete_warning_2}`,
      showConfirmButton: true,
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        itemCheckboxes.forEach((checkbox) => {
          if (checkbox.checked) deleteNoteIdb(parseInt(checkbox.value, 10));
        });
      }
    });
  });

  let showCheckbox = false;
  document.getElementById('multiSelect').addEventListener('click', (event) => {
    const toggleSelectAllButton = document.getElementById('selectAll');
    const actionButtons = [
      document.getElementById('downloadSelected'),
      document.getElementById('deleteSelected'),
    ];
    const itemCheckboxes = document.querySelectorAll('.note-checkbox');
    if (!showCheckbox) {
      showCheckbox = !showCheckbox;
      updateActionButtons();
      event.target.textContent = translations.cancel;
      toggleSelectAllButton.style = '';

      actionButtons.forEach((button) => (button.style = ''));

      itemCheckboxes.forEach((noteCheckbox) => {
        noteCheckbox.style.display = 'block';
        noteCheckbox.addEventListener('change', () => {
          updateToggleSelectAllButton();
          updateActionButtons();
        });
      });
    } else {
      showCheckbox = !showCheckbox;
      event.target.textContent = translations.select;
      toggleSelectAllButton.style.display = 'none';
      actionButtons.forEach((button) => (button.style.display = 'none'));
      itemCheckboxes.forEach((noteCheckbox) => {
        noteCheckbox.style.display = 'none';
        noteCheckbox.checked = false;
      });
    }
    console.log(translations.select, translations.cancel);
  });

  const parent = document.querySelector('.popup');
  const child = document.getElementById('closePopup');

  parent.addEventListener('scroll', () => {
    const parentRect = parent.getBoundingClientRect();

    if (parent.scrollTop > 0) {
      child.style.position = 'fixed';
      child.style.top = `${parentRect.top}px`;
    } else {
      child.style.position = 'absolute';
      child.style.top = '0';
    }
  });
});
