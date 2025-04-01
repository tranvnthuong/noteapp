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
          store.createIndex('content', 'plainText', { unique: false });
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
  }

  let sortNotesBy;
  let easyMDE;
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

      easyMDE = new EasyMDE({
        element: document.getElementById('editor'),
        spellChecker: false,
        inputStyle: 'contenteditable',
        sideBySideFullscreen: false,
        placeholder: `# ${translations.title}\n${translations.content}`,
        insertTexts: {
          horizontalRule: ['', '\n\n---\n\n'],
          image: [`![${translations.image_description}]`, '(https://)'],
          link: [`[${translations.text_link}]`, '(https://)'],
          table: [
            `\n\n|   ${translations.column} 1   |   ${translations.column} 2   |   ${translations.column} 3   |\n| --- | --- | --- |\n| ${translations.data} 1 | ${translations.data} 2 | ${translations.data} 3 |\n`,
            '\n',
          ],
        },
        renderingConfig: {
          codeSyntaxHighlighting: true,
        },
        previewRender: function (plainText) {
          let html = marked.parse(plainText);
          setTimeout(() => {
            document.querySelectorAll('pre code').forEach((block) => {
              hljs.highlightElement(block);
              let language =
                block.result?.language ||
                block.className.replace('language-', '') ||
                'Plain Text';
              block.setAttribute('data-lang', language);
            });
          }, 10);
          return html;
        },
        toolbar: [
          {
            name: 'bold',
            action: EasyMDE.toggleBold,
            className: 'fa fa-bold',
            title: translations.bold,
          },
          {
            name: 'italic',
            action: EasyMDE.toggleItalic,
            className: 'fa fa-italic',
            title: translations.italic,
          },
          {
            name: 'heading',
            action: EasyMDE.toggleHeadingSmaller,
            className: 'fa fa-header',
            title: translations.heading,
          },
          '|',
          {
            name: 'quote',
            action: EasyMDE.toggleBlockquote,
            className: 'fa fa-quote-left',
            title: translations.quote,
          },
          {
            name: 'unordered-list',
            action: EasyMDE.toggleUnorderedList,
            className: 'fa fa-list-ul',
            title: translations.unordered_list,
          },
          {
            name: 'ordered-list',
            action: EasyMDE.toggleOrderedList,
            className: 'fa fa-list-ol',
            title: translations.ordered_list,
          },
          '|',
          {
            name: 'link',
            action: EasyMDE.drawLink,
            className: 'fa fa-link',
            title: translations.link,
          },
          {
            name: 'image',
            action: EasyMDE.drawImage,
            className: 'fa fa-picture-o',
            title: translations.image,
          },
          {
            name: 'table',
            action: EasyMDE.drawTable,
            className: 'fa fa-table',
            title: translations.table,
          },
          '|',
          {
            name: 'code',
            action: EasyMDE.toggleCodeBlock,
            className: 'fa fa-code',
            title: translations.code,
          },
          {
            name: 'horizontal-rule',
            action: EasyMDE.drawHorizontalRule,
            className: 'fa fa-minus',
            title: translations.horizontal_rule,
          },
          {
            name: 'superLargeText',
            action: function (editor) {
              const cm = editor.codemirror;
              const selectedText = cm.getSelection() || translations.large_text;
              const customHTML = `<b><p style="color:red;font-size:8rem;text-align:center">${selectedText}</p></b>`;
              cm.replaceSelection(customHTML);
            },
            className: 'fa fa-s',
            title: translations.super_text,
          },
          '|',
          {
            name: 'side-by-side',
            action: EasyMDE.toggleSideBySide,
            className: 'fa fa-columns no-disable no-mobile',
            title: translations.side_by_side,
          },
          {
            name: 'preview',
            action: EasyMDE.togglePreview,
            className: 'fa fa-eye no-disable',
            title: translations.preview,
          },
          {
            name: 'guide',
            action: function () {
              window.open(
                `https://chatgpt.com?q=${encodeURIComponent(
                  `What is Markdown, All about markdown syntax, answer me in "${navigator.language}" language`
                )}`,
                '_blank'
              );
            },
            className: 'fa fa-question-circle',
            title: translations.guide,
          },
          '|',
          {
            name: 'undo',
            action: EasyMDE.undo,
            className: 'fa fa-undo',
            title: translations.undo,
          },
          {
            name: 'redo',
            action: EasyMDE.redo,
            className: 'fa fa-repeat fa-redo',
            title: translations.redo,
          },
        ],
      });

      marked.setOptions({
        gfm: true,
        breaks: true,
      });

      document
        .querySelectorAll('.EasyMDEContainer .editor-toolbar button')
        .forEach((btn) => btn.setAttribute('data-toggle', 'tooltip'));

      reloadToolTips();
    } catch (error) {
      console.error(error);
    }
  }

  init();

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
    const id = parseInt(urlParams.get('noteId'), 10);
    if (id) {
      urlParams.delete('noteId');
      history.pushState({}, '', window.location.pathname);
      const note = await getNote(id);
      if (note.found) {
        showNote(id);
      } else {
        try {
          const response = await fetch(`${WEBSERVER}/${id}`);
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
        noteElement.innerHTML = `<input class="note-checkbox" id="note${
          note.id
        }" value="${note.id}" type="checkbox">
                    <div class="card" onclick="showNote(${note.id})">
                    <div class="card-body">
                        <h5 class="card-title">${note.titleText}</h5>
                        <div class="card-text">${note.plainText.replace(
                          note.titleText,
                          ''
                        )}</div>
                        <div class="d-flex justify-content-between align-items-center mt-2 mb-0">
                            <p class="text-muted small mb-0">${
                              note.dateString
                            }</p>
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

  const resetHighlight = () => {
    const root = document.getElementById('output');
    root.innerHTML = root.innerHTML.replace(/<mark>(.*?)<\/mark>/g, '$1');
  };

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      if (e.target.value.trim() === '') {
        document.getElementById('searchIcon').classList.remove('found');
        document.getElementById('searchIcon').classList.remove('not-found');
        if (searchInNote) {
          resetHighlight();
        } else {
          document
            .querySelectorAll('[data-note-id]')
            .forEach((e) => e.classList.remove('d-none'));
        }
        return;
      }

      let keyword = e.target.value;
      if (searchInNote) {
        resetHighlight();
        const root = document.getElementById('output');
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        const nodesToHighlight = [];
        let found = false;

        while ((node = walker.nextNode())) {
          if (node.nodeValue.toLowerCase().includes(keyword.toLowerCase())) {
            nodesToHighlight.push(node);
            found = true;
            document.getElementById('searchIcon').classList.add('found');
            document.getElementById('searchIcon').classList.remove('not-found');
          }
          if (!found) {
            document.getElementById('searchIcon').classList.remove('found');
            document.getElementById('searchIcon').classList.add('not-found');
          }
        }

        nodesToHighlight.forEach((node) => {
          const regex = new RegExp(`(${keyword})`, 'gi');
          const newNode = document.createElement('span');
          newNode.innerHTML = node.nodeValue.replace(regex, '<mark>$1</mark>');
          node.parentNode.replaceChild(newNode, node);
        });

        const firstMark = document.querySelector('#output mark');
        if (firstMark) {
          firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        const transaction = db.transaction('notes', 'readonly');
        const store = transaction.objectStore('notes');
        const request = store.getAll();
        request.onsuccess = function (event) {
          const notes = event.target.result;
          notes.forEach((note) => {
            let title = note.titleText.toLowerCase();
            let text = note.plainText.toLowerCase();

            if (!text.includes(keyword) && !title.includes(keyword)) {
              //Not found
              document
                .querySelector(`div[data-note-id="${note.id}"]`)
                .classList.add('d-none');
              document.getElementById('searchIcon').classList.remove('found');
              document.getElementById('searchIcon').classList.add('not-found');
            } else {
              //Found
              document
                .querySelector(`div[data-note-id="${note.id}"]`)
                .classList.remove('d-none');
              document.getElementById('searchIcon').classList.add('found');
              document
                .getElementById('searchIcon')
                .classList.remove('not-found');
            }
          });
        };
      }
    }, 1000)
  );

  document.getElementById('closePopup').addEventListener('click', () => {
    const popup = document.getElementById('popup');
    popup.classList.remove('show');
    popup.classList.add('hide');
    document.getElementById('updateNote').style.display = 'none';
    document.getElementById('popupHeader').textContent = translations.new_note;
  });

  document.getElementById('closeFullscreen').addEventListener('click', () => {
    document.getElementById('fullscreenNote').classList.add('d-none');
  });

  document.getElementById('enableFullscreen').addEventListener('click', () => {
    document.getElementById('fullscreenNote').classList.remove('d-none');
  });

  let searchInNote = false;
  window.showNote = function (id) {
    let noteList = document.querySelector('.notes-list');
    noteList.style.overflowY = 'hidden';
    noteList.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
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

      let htmlContent = marked.parse(note.markdownContent);
      document.getElementById('output').innerHTML = htmlContent;
      document.getElementById('renderNote').innerHTML = htmlContent;

      setTimeout(() => {
        document
          .querySelectorAll('.output-note pre code, .render-note pre code')
          .forEach((block) => {
            hljs.highlightElement(block);
            let language =
              block.result?.language ||
              block.className.replace('language-', '') ||
              'Plain Text';
            block.setAttribute('data-lang', language);
          });

        document
          .querySelectorAll('.output-note pre, .render-note pre')
          .forEach((pre) => {
            pre.classList.add('code-block');
            let copyBtn = document.createElement('button');
            copyBtn.classList.add('copy-btn');
            copyBtn.innerText = translations.copy;
            copyBtn.addEventListener('click', function () {
              let code = pre.querySelector('code').innerText;
              navigator.clipboard
                .writeText(code)
                .then(() => {
                  copyBtn.innerText = translations.copied;
                  setTimeout(
                    () => (copyBtn.innerText = translations.copy),
                    1500
                  );
                })
                .catch((err) => {
                  console.error('Lỗi sao chép:', err);
                });
            });
            pre.appendChild(copyBtn);
          });
      }, 10);

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
        showNote.classList.add('d-none');
        deleteNote(note.id);
        searchInNote = false;
      };

      document.getElementById('closeShow').onclick = function () {
        document.querySelector('.notes-list').style = '';
        document
          .getElementById('searchInput')
          .setAttribute('placeholder', translations.placeholder_search);
        document.getElementById('output').innerHTML = '';
        showNote.classList.add('d-none');
        searchInNote = false;
      };

      searchInNote = true;
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
      popup.classList.remove('hide');
      popup.classList.add('show');

      easyMDE.value(note.markdownContent);
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

  function getFirstHeading(markdownText) {
    let match = markdownText.match(/^#{1,6} (.+)/m);
    return match ? match[1] : translations.no_title;
  }

  function getPlainText(markdownText) {
    let htmlContent = marked.parse(markdownText);
    let tempElement = document.createElement('div');
    tempElement.innerHTML = htmlContent;
    return tempElement.textContent || tempElement.innerText;
  }

  window.updateNote = function (id) {
    const transaction = db.transaction('notes', 'readwrite');
    const store = transaction.objectStore('notes');
    const request = store.get(id);
    request.onsuccess = function (event) {
      const { shared } = event.target.result;

      let markdownContent = easyMDE.value();
      let firstHeading = getFirstHeading(markdownContent);
      let plainText = getPlainText(markdownContent);

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
        titleText: firstHeading,
        markdownContent,
        plainText,
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
          ).value = `${STATIC_REPOSITORY}?noteId=${shareNotes.getIdNote()}`;
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
      let response = await fetch(`${WEBSERVER}/get-verification-code`);
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
          let response = await fetch(WEBSERVER, {
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
        if (isOffline()) return;
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

  function isEditorEmpty() {
    let markdownContent = easyMDE.value().trim();
    let plainText = marked
      .parse(markdownContent)
      .replace(/<\/?[^>]+(>|$)/g, '')
      .trim();

    return plainText === '';
  }

  window.sidebar = function (mode) {
    const popup = document.getElementById('popup');
    switch (mode) {
      case 'newNote':
        if (popup.classList.contains('show')) {
          return;
        }
        document.getElementById('addAndShare').style.display = 'initial';
        popup.classList.remove('hide');
        popup.classList.add('show');
        easyMDE.value('');
        break;
      case 'useCode':
        Swal.fire({
          title: translations.enter_note_code,
          input: 'number',
          inputmode: 'numeric',
          inputPlaceholder: translations.code_placeholder,
          inputAttributes: {
            min: 100000, // Số nhỏ nhất (6 chữ số)
            max: 999999999, // Số lớn nhất (9 chữ số)
            step: 1, // Chỉ cho phép nhập số nguyên
          },
          showCancelButton: true,
          cancelButtonText: translations.cancel,
          confirmButtonText: translations.search,
          showLoaderOnConfirm: true,
          preConfirm: async (id) => {
            if (id.trim() === '') {
              return Swal.showValidationMessage(translations.note_code_require);
            } else if (!id.match(/^\d{6,9}$/)) {
              return Swal.showValidationMessage(translations.numbers_require);
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
                const response = await fetch(`${WEBSERVER}/${id}
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
      if (isEditorEmpty()) return;

      let markdownContent = easyMDE.value();
      let firstHeading = getFirstHeading(markdownContent);
      let plainText = getPlainText(markdownContent);

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

      id = id ?? Math.floor(Math.random() * (999999999 - 100000)) + 100000;

      const notes = {
        id: id,
        titleText: firstHeading,
        markdownContent,
        plainText,
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
      if (isEditorEmpty()) return;
      if (isOffline()) return;
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
            if (id.trim() === '') {
              id = null;
            } else if (!id.match(/^\d{6,9}$/)) {
              Toast.fire({
                icon: 'warning',
                title: translations.id_require_options,
              });
              return;
            } else {
              id = parseInt(id, 10);
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
              const response = await fetch(WEBSERVER, {
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

  function isOffline() {
    if (navigator.onLine) return false;
    else {
      Swal.fire({
        icon: 'warning',
        title: translations.you_are_offline,
        text: translations.turn_on_wifi_or_mobile_data,
      });
      return true;
    }
  }

  // const fetchAffiliateAPI = async () => {
  //   try {
  //     const response = await fetch(`${WEBSERVER}/affiliate`);
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }
  //     const data = await response.json();
  //     localStorage.setItem('affiliateData', JSON.stringify(data));
  //     return data;
  //   } catch (error) {
  //     let affiliateData = localStorage.getItem('affiliateData') || '[]';
  //     return JSON.parse(affiliateData);
  //   }
  // };

  const fetchAffiliateAPI = async () => {
    return {
      expired: Date.now() + 1000 * 60 * 60 * 24 * 2,
      listAffiliate: [
        {
          imageURL:
            'https://cf.shopee.vn/file/vn-11134258-7ra0g-m801wyxqitf253.webp',
          title: '',
          linkURL: 'https://example.com/2',
        },
        {
          imageURL:
            'https://down-vn.img.susercontent.com/file/vn-11134258-7ra0g-m7v7fjtc1d37da.webp',
          title: 'Ngàu hội đồ ăn',
          linkURL: 'https://example.com/2',
        },
        {
          imageURL:
            'https://down-vn.img.susercontent.com/file/vn-11134258-7ra0g-m7v7fjtc1d37da.webp',
          title: 'Ngàu hội đồ ăn',
          linkURL: 'https://example.com/2',
        },
        {
          imageURL:
            'https://down-vn.img.susercontent.com/file/vn-11134258-7ra0g-m7v7fjtc1d37da.webp',
          title: 'Ngàu hội đồ ăn',
          linkURL: 'https://example.com/2',
        },
        {
          imageURL: '',
          title: 'Affiliate 5',
          linkURL: 'https://example.com/5',
        },
      ],
    };
  };

  const clickAffiliate = (affiliate) => {
    window.open(affiliate.linkURL, '_blank');
    fetch(`${WEBSERVER}/click-affiliate/${affiliate.id}`)
      .then((response) => {
        if (!response.ok) {
          console.error('Error fetching affiliate data:', response.statusText);
        }
      })
      .catch((error) => {
        console.error('Error fetching affiliate data', error);
      });
  };

  const loadAffiliate = async () => {
    if (isOffline()) return;
    let affiliateData = localStorage.getItem('affiliateData') || '[]';
    if (affiliateData.expired < Date.now() || affiliateData === '[]') {
      affiliateData = await fetchAffiliateAPI();
    }
    let randomData =
      affiliateData.listAffiliate[
        Math.floor(Math.random() * affiliateData.listAffiliate.length)
      ];

    document.getElementById('affiliateContent')?.remove();
    const affiliateContent = document.createElement('div');
    affiliateContent.className = 'affiliate-content';
    affiliateContent.id = 'affiliateContent';
    affiliateContent.innerHTML = `
      <div>
        <button id="closeAffiliate">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div id="affiliateBanner"></div>
      </div>
      `;
    document.body.appendChild(affiliateContent);

    let affiliateBanner = document.getElementById('affiliateBanner');
    affiliateBanner.innerHTML = '';
    let imgElement = document.createElement('img');
    if (randomData.imageURL) {
      imgElement.src = randomData.imageURL;
      imgElement.alt = randomData.title;
      let titleElement = document.createElement('p');
      titleElement.textContent = randomData.title;
      imgElement.onclick = () => {
        clickAffiliate(randomData);
      };
      titleElement.onclick = () => {
        clickAffiliate(randomData);
      };
      affiliateBanner.appendChild(imgElement);
      affiliateBanner.appendChild(titleElement);
    } else {
      imgElement.src = 'assets/shopee-aff1.webp';
      imgElement.alt = 'Affiliate Banner';
      affiliateBanner.appendChild(imgElement);
      imgElement.onclick = () => {
        clickAffiliate(randomData);
      };
    }

    if (Math.random() < 0.3) {
      document.getElementById('closeAffiliate').onclick = () => {
        clickAffiliate(randomData);
        affiliateContent.remove();
      };
      affiliateContent.onclick = () => {
        clickAffiliate(randomData);
      };
    } else {
      document.getElementById('closeAffiliate').onclick = () => {
        affiliateContent.remove();
      };
    }
  };

  setInterval(loadAffiliate, 1000 * 120);

  if (Math.random() < 0.5) {
    setTimeout(() => {
      loadAffiliate();
    }, Math.floor(Math.random() * 8000)); // 0-8s
  }
});
