/* Fake shell for the terminal UI. Progressive enhancement: the page already
   renders its content as the output of a command; this adds an interactive
   prompt on top. */
(function () {
  'use strict';

  var screen = document.getElementById('term-screen');
  var output = document.getElementById('term-output');
  var form = document.getElementById('term-input');
  var field = document.getElementById('term-field');
  var fsEl = document.getElementById('term-fs');
  var statusPath = document.querySelector('.status-path');
  if (!screen || !output || !form || !field || !fsEl) return;

  var data = JSON.parse(fsEl.textContent);
  var USER = 'ivan'; // owner of the files, not the visitor
  var SITE_TITLE = data.siteTitle;

  // ------------------------------------------------------------ filesystem

  function dir(name, url) { return { type: 'dir', name: name, url: url, children: {} }; }
  function file(name, info) {
    return { type: 'file', name: name, url: info.url, title: info.title, date: info.date };
  }

  var root = dir('~', data.homeUrl);
  root.title = data.about.title;
  root.children['about.md'] = file('about.md', data.about);
  var postsDir = dir('posts', data.postsUrl);
  postsDir.title = 'Posts';
  data.posts.forEach(function (p) { postsDir.children[p.name] = file(p.name, p); });
  root.children.posts = postsDir;

  (function linkParents(node) {
    Object.keys(node.children).forEach(function (k) {
      var child = node.children[k];
      child.parent = node;
      if (child.type === 'dir') linkParents(child);
    });
  })(root);

  var cwd = root;

  function walk(node, fn) {
    fn(node);
    if (node.type === 'dir') Object.keys(node.children).forEach(function (k) { walk(node.children[k], fn); });
  }

  // URL -> node, so plain links can be turned into commands
  var byUrl = {};
  function normUrl(u) { return u.replace(/\.html$/, '').replace(/\/index$/, '/'); }
  walk(root, function (n) { if (n.type === 'file') byUrl[normUrl(n.url)] = n; });
  byUrl[normUrl(data.postsUrl)] = postsDir;

  function pathOf(node) {
    var parts = [];
    for (var n = node; n && n !== root; n = n.parent) parts.unshift(n.name);
    return parts.length ? '~/' + parts.join('/') : '~';
  }

  // Shortest way to reference `node` from the current directory
  function relTo(node) {
    if (node === cwd) return '.';
    if (node === root) return '~';
    var suffix = node.type === 'dir' ? '/' : '';
    if (node.parent === cwd) return node.name + suffix;
    var fromRoot = pathOf(node).slice(2) + suffix;
    return cwd === root ? fromRoot : '~/' + fromRoot;
  }

  function resolve(path) {
    if (!path) return cwd;
    var node = cwd;
    var rest = path;
    if (path === '~' || path.indexOf('~/') === 0) { node = root; rest = path.slice(1); }
    else if (path.charAt(0) === '/') { node = root; }
    var parts = rest.split('/');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p || p === '.') continue;
      if (p === '..') { node = node.parent || node; continue; }
      if (node.type !== 'dir' || !node.children[p]) return null;
      node = node.children[p];
    }
    if (/\/$/.test(path) && node.type === 'file') return null;
    return node;
  }

  function countFiles(node) {
    var n = 0;
    walk(node, function (x) { if (x.type === 'file') n++; });
    return n;
  }

  // ------------------------------------------------------------ rendering

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function ps1() {
    var f = document.createDocumentFragment();
    f.appendChild(el('span', 'ps1-path', pathOf(cwd)));
    f.appendChild(document.createTextNode('\u00a0'));
    f.appendChild(el('span', 'ps1-sign', '$'));
    f.appendChild(document.createTextNode('\u00a0'));
    return f;
  }

  function updatePrompt() {
    var label = form.querySelector('.term-ps1');
    label.textContent = '';
    label.appendChild(ps1());
  }

  function newBlock(line) {
    var block = el('div', 'term-block');
    var cmd = el('p', 'term-cmd');
    var p = el('span', 'term-ps1');
    p.appendChild(ps1());
    cmd.appendChild(p);
    cmd.appendChild(el('span', 'term-typed', line));
    block.appendChild(cmd);
    var res = el('div', 'term-result');
    block.appendChild(res);
    output.appendChild(block);
    return { block: block, res: res };
  }

  function print(res, text, cls) {
    var line = el('div', 'term-line' + (cls ? ' ' + cls : ''), text);
    res.appendChild(line);
    return line;
  }

  function err(res, text) { return print(res, text, 'term-err'); }

  function nodeLink(node, label) {
    var a = el('a', node.type === 'dir' ? 'ls-dir' : 'ls-file', label || (node.name + (node.type === 'dir' ? '/' : '')));
    a.href = node.url;
    return a;
  }

  function externalLink(url, label) {
    var a = el('a', null, label);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function scrollToBottom() { screen.scrollTop = screen.scrollHeight; }

  function scrollToBlock(block) {
    screen.scrollTop = Math.max(0, block.offsetTop - 16);
  }

  // ------------------------------------------------------------ commands

  function lsShort(res, node) {
    var ul = el('ul', 'ls-short');
    Object.keys(node.children).forEach(function (k) {
      var li = el('li');
      li.appendChild(nodeLink(node.children[k]));
      ul.appendChild(li);
    });
    res.appendChild(ul);
  }

  function lsLong(res, node) {
    var keys = Object.keys(node.children);
    res.appendChild(el('p', 'ls-total', 'total ' + keys.length));
    var ul = el('ul', 'ls');
    keys.forEach(function (k) {
      var child = node.children[k];
      var li = el('li');
      li.appendChild(el('span', 'ls-perm', child.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'));
      li.appendChild(el('span', 'ls-owner', USER));
      li.appendChild(el('span', 'ls-date', child.date || data.today));
      var a = nodeLink(child);
      a.className = 'ls-name';
      li.appendChild(a);
      var desc = child.type === 'dir' ? countFiles(child) + ' files' : child.title;
      if (desc) li.appendChild(el('span', 'ls-desc', '# ' + desc));
      ul.appendChild(li);
    });
    res.appendChild(ul);
  }

  var cache = {};
  function fetchContent(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var main = doc.querySelector('main.term-result');
        if (!main) throw new Error('unreadable file');
        cache[url] = main.innerHTML;
        return cache[url];
      });
  }

  // Keep URL, status bar and tab title in sync with what the terminal shows
  function setLocation(node) {
    if (!node || !node.url) return;
    if (location.pathname !== node.url) {
      try { history.pushState({ path: pathOf(node) }, '', node.url); } catch (e) { /* ignore */ }
    }
    if (statusPath) statusPath.textContent = node.url;
    document.title = (node.title || node.name) + ' · ' + SITE_TITLE;
  }

  var history_ = [];
  var HISTORY_KEY = 'term-history';
  try { history_ = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { history_ = []; }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history_.slice(-100))); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------ easter eggs
  // Hidden system files for curious visitors. Not listed in ~ on purpose.

  var PASSWD = [
    'root:x:0:0:root:/root:/bin/bash',
    'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
    'ivan:x:1000:1000:Iv\u00e1n Guardado,,,:/home/ivan:/bin/zsh',
    'guest:x:1001:1001:You. Yes, you \ud83d\udc4b:/home/guest:/bin/bash',
    'rody:x:1002:1002::/home/rody:/bin/bash',
    'DuChe:x:1003:1003::/home/DuChe:/bin/bash',
    'ShadowJob:x:1004:1004::/home/ShadowJob:/bin/bash',
    'WerBybe:x:1005:1005::/home/WerBybe:/bin/bash',
    'LlaS:x:1006:1006::/home/LlaS:/bin/bash'
  ];

  var SYSTEM_FILES = {
    '/etc/passwd': function (res) {
      res.appendChild(el('div', 'term-pre', PASSWD.join('\n')));
      print(res, '\n# Nice try \ud83d\ude0f No passwords here, just an x. The juicy stuff lives in /etc/shadow\u2026', 'term-muted');
    },
    '/etc/shadow': function (res) {
      err(res, 'cat: /etc/shadow: Permission denied');
      print(res, 'Bold move \ud83d\udd75\ufe0f Even with root you would only find hashes of coffee recipes.', 'term-muted');
    }
  };

  function systemPath(path) {
    var p = '/' + String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');
    return p;
  }

  var HELP = [
    ['help', 'show this help'],
    ['ls [-l] [dir]', 'list directory contents'],
    ['cd <dir>', 'change directory'],
    ['cat <file>', 'print a file (read a post)'],
    ['tree', 'show the whole filesystem'],
    ['pwd', 'print working directory'],
    ['whoami', 'who are you?'],
    ['history', 'show command history'],
    ['clear', 'clear the screen (Ctrl+L)']
  ];

  var commands = {
    help: function (args, res) {
      var dl = el('dl', 'help');
      HELP.forEach(function (h) {
        dl.appendChild(el('dt', null, h[0]));
        dl.appendChild(el('dd', null, h[1]));
      });
      res.appendChild(dl);
      print(res, 'Tip: Tab autocompletes, ↑/↓ browse history. Links are clickable too.', 'term-muted');
    },

    ls: function (args, res) {
      var long = false;
      var targets = [];
      args.forEach(function (a) {
        if (a.charAt(0) === '-' && a.length > 1) { if (a.indexOf('l') !== -1) long = true; }
        else targets.push(a);
      });
      if (!targets.length) targets.push('');
      targets.forEach(function (t, i) {
        if (t.charAt(0) === '/' && systemPath(t) === '/etc') {
          var etc = el('ul', 'ls-short');
          ['passwd', 'shadow'].forEach(function (n) { etc.appendChild(el('li', null, n)); });
          return res.appendChild(etc);
        }
        var node = resolve(t);
        if (!node) return err(res, "ls: cannot access '" + t + "': No such file or directory");
        if (node.type === 'file') {
          var ul = el('ul', 'ls-short');
          var li = el('li');
          li.appendChild(nodeLink(node, t));
          ul.appendChild(li);
          return res.appendChild(ul);
        }
        if (targets.length > 1) print(res, (i ? '\n' : '') + t + ':');
        (long ? lsLong : lsShort)(res, node);
        if (targets.length === 1) setLocation(node);
      });
    },

    cd: function (args, res) {
      var target = args[0] || '~';
      var node = resolve(target);
      if (!node) return err(res, 'cd: ' + target + ': No such file or directory');
      if (node.type !== 'dir') return err(res, 'cd: ' + target + ': Not a directory');
      cwd = node;
      updatePrompt();
      setLocation(node);
    },

    pwd: function (args, res) {
      print(res, pathOf(cwd).replace(/^~/, '/home/' + USER));
    },

    cat: function (args, res, ctx) {
      if (!args.length) return err(res, 'cat: missing file operand. Try `ls` to see what is here.');
      var chain = Promise.resolve();
      args.forEach(function (a) {
        chain = chain.then(function () {
          if (SYSTEM_FILES[systemPath(a)] && a.charAt(0) === '/') return SYSTEM_FILES[systemPath(a)](res);
          var node = resolve(a);
          if (!node) return err(res, 'cat: ' + a + ': No such file or directory');
          if (node.type === 'dir') return err(res, 'cat: ' + a + ': Is a directory');
          var loading = print(res, 'reading ' + a + '…', 'term-muted');
          return fetchContent(node.url).then(function (html) {
            var wrap = el('div', 'term-file');
            wrap.innerHTML = html;
            res.replaceChild(wrap, loading);
            if (args.length === 1) setLocation(node);
            ctx.scrollTo = 'block';
          }, function (e) {
            res.removeChild(loading);
            err(res, 'cat: ' + a + ': ' + e.message);
          });
        });
      });
      return chain;
    },

    tree: function (args, res) {
      var start = resolve(args[0]);
      if (!start) return err(res, (args[0] || '') + ' [error opening dir]');
      var pre = el('div', 'tree');
      var dirs = 0, files = 0;
      pre.appendChild(el('div', 'ls-dir', start === cwd ? '.' : relTo(start)));
      (function draw(node, prefix) {
        var keys = Object.keys(node.children);
        keys.forEach(function (k, i) {
          var child = node.children[k];
          var last = i === keys.length - 1;
          var row = el('div');
          row.appendChild(el('span', 'tree-branch', prefix + (last ? '└── ' : '├── ')));
          row.appendChild(nodeLink(child, child.name));
          pre.appendChild(row);
          if (child.type === 'dir') { dirs++; draw(child, prefix + (last ? '    ' : '│   ')); }
          else files++;
        });
      })(start, '');
      res.appendChild(pre);
      print(res, '\n' + dirs + ' director' + (dirs === 1 ? 'y' : 'ies') + ', ' + files + ' files', 'term-muted');
    },

    whoami: function (args, res) {
      print(res, 'guest');
      var line = print(res, 'No idea who you are \ud83e\udd14 but I\'d love to find out. Say hi on ');
      line.appendChild(externalLink(data.twitterUrl, 'Twitter'));
      line.appendChild(document.createTextNode(' or '));
      line.appendChild(externalLink(data.linkedinUrl, 'LinkedIn'));
      line.appendChild(document.createTextNode(' \ud83d\udc4b'));
    },

    echo: function (args, res) { print(res, args.join(' ')); },

    date: function (args, res) { print(res, new Date().toString()); },

    history: function (args, res) {
      history_.forEach(function (h, i) { print(res, String(i + 1).padStart(5) + '  ' + h); });
    },

    clear: function () { output.textContent = ''; },

    sudo: function (args, res) {
      err(res, 'guest is not in the sudoers file. This incident will be reported.');
    },

    rm: function (args, res) { err(res, 'rm: cannot remove: Read-only file system'); },

    exit: function (args, res) { print(res, 'There is no escape. Try `help` instead.', 'term-muted'); }
  };
  commands.ll = function (args, res) { return commands.ls(['-l'].concat(args), res); };
  ['vim', 'vi', 'nano', 'emacs', 'less', 'more'].forEach(function (name) {
    commands[name] = function (args, res, ctx) {
      print(res, name + ' is not installed here, falling back to cat…', 'term-muted');
      return commands.cat(args, res, ctx);
    };
  });

  var VISIBLE_COMMANDS = ['cat', 'cd', 'clear', 'date', 'echo', 'help', 'history', 'ls', 'pwd', 'tree', 'whoami'];

  // ------------------------------------------------------------ execution

  function tokenize(str) {
    var out = [];
    var re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    var m;
    while ((m = re.exec(str))) out.push(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
    return out;
  }

  var busy = false;

  function run(line, opts) {
    opts = opts || {};
    line = line.trim();
    if (busy) return;

    if (!line) {
      newBlock('');
      return done({ scrollTo: 'bottom' }, opts);
    }

    if (history_[history_.length - 1] !== line) { history_.push(line); saveHistory(); }

    var view = newBlock(line);
    var ctx = { scrollTo: 'bottom' };
    var parts = line.split(/\s*(?:&&|;)\s*/).filter(Boolean);

    busy = true;
    form.hidden = true;

    var chain = Promise.resolve();
    parts.forEach(function (part) {
      chain = chain.then(function () {
        var tokens = tokenize(part);
        var name = tokens.shift();
        var fn = Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : null;
        if (!fn) return err(view.res, 'bash: ' + name + ': command not found. Type `help` to see available commands.');
        return fn(tokens, view.res, ctx);
      });
    });

    chain.catch(function (e) { err(view.res, String(e)); }).then(function () {
      busy = false;
      form.hidden = false;
      if (!view.res.childNodes.length) view.res.remove();
      if (!view.block.parentNode) ctx.scrollTo = 'top';
      if (ctx.scrollTo === 'block') scrollToBlock(view.block);
      else done(ctx, opts);
      if (opts.focus !== false) field.focus({ preventScroll: true });
    });
  }

  function done(ctx, opts) {
    if (ctx.scrollTo === 'top') screen.scrollTop = 0;
    else scrollToBottom();
    if (opts && opts.focus !== false) field.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ completion

  function commonPrefix(list) {
    if (!list.length) return '';
    var p = list[0];
    list.forEach(function (s) { while (s.indexOf(p) !== 0) p = p.slice(0, -1); });
    return p;
  }

  function complete() {
    var value = field.value;
    var m = value.match(/^(.*?)(\S*)$/);
    var before = m[1];
    var word = m[2];
    var isCommand = !before.trim() || /(&&|;)\s*$/.test(before);
    var candidates, apply;

    if (isCommand) {
      candidates = VISIBLE_COMMANDS.filter(function (c) { return c.indexOf(word) === 0; });
      apply = function (c, unique) { return before + c + (unique ? ' ' : ''); };
    } else {
      var slash = word.lastIndexOf('/');
      var dirPart = slash === -1 ? '' : word.slice(0, slash + 1);
      var base = slash === -1 ? word : word.slice(slash + 1);
      var node = resolve(dirPart);
      if (!node || node.type !== 'dir') return;
      var names = Object.keys(node.children).map(function (k) {
        return k + (node.children[k].type === 'dir' ? '/' : '');
      });
      candidates = names.filter(function (n) { return n.indexOf(base) === 0; });
      apply = function (c, unique) { return before + dirPart + c + (unique && !/\/$/.test(c) ? ' ' : ''); };
    }

    if (!candidates.length) return;
    if (candidates.length === 1) { field.value = apply(candidates[0], true); return; }

    var prefix = commonPrefix(candidates);
    var current = isCommand ? word : word.slice(word.lastIndexOf('/') + 1);
    if (prefix.length > current.length) { field.value = apply(prefix, false); return; }

    // Ambiguous: list the options like bash does, keep the current line
    var view = newBlock(value);
    var ul = el('ul', 'ls-short');
    candidates.forEach(function (c) { ul.appendChild(el('li', null, c)); });
    view.res.appendChild(ul);
    scrollToBottom();
  }

  // ------------------------------------------------------------ block cursor

  // Mirror the field into a visible span so the cursor can be a solid block
  // that follows the caret, like an old hardware terminal.
  var echo = document.getElementById('term-echo');

  function renderEcho() {
    if (!echo) return;
    var value = field.value;
    var pos = field.selectionStart == null ? value.length : field.selectionStart;
    echo.textContent = '';
    echo.appendChild(document.createTextNode(value.slice(0, pos)));
    echo.appendChild(el('span', 'caret', value.charAt(pos) || ' '));
    echo.appendChild(document.createTextNode(value.slice(pos + 1)));
  }

  if (echo) {
    form.classList.add('has-echo');
    ['input', 'focus', 'blur', 'select', 'click'].forEach(function (evt) {
      field.addEventListener(evt, renderEcho);
    });
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === field) renderEcho();
    });
    renderEcho();
  }

  // ------------------------------------------------------------ events

  var cursor = -1;
  var draft = '';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = field.value;
    field.value = '';
    cursor = -1;
    renderEcho();
    run(value);
  });

  field.addEventListener('keydown', function (e) {
    setTimeout(renderEcho, 0);
    if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp') {
      if (!history_.length) return;
      e.preventDefault();
      if (cursor === -1) { draft = field.value; cursor = history_.length; }
      cursor = Math.max(0, cursor - 1);
      field.value = history_[cursor];
    } else if (e.key === 'ArrowDown') {
      if (cursor === -1) return;
      e.preventDefault();
      cursor++;
      if (cursor >= history_.length) { cursor = -1; field.value = draft; }
      else field.value = history_[cursor];
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      output.textContent = '';
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && !String(window.getSelection())) {
      e.preventDefault();
      var view = newBlock(field.value + '^C');
      view.res.remove();
      field.value = '';
      cursor = -1;
      scrollToBottom();
    }
  });

  // Internal links become commands; modified clicks keep the browser behaviour
  output.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.origin !== location.origin || a.target === '_blank') return;
    var node = byUrl[normUrl(a.pathname)];
    if (!node) return;
    e.preventDefault();
    var path = relTo(node);
    run(node.type === 'dir' ? 'ls -l ' + path : 'cat ' + path, { focus: false });
  });

  screen.addEventListener('click', function (e) {
    if (e.target.closest('a') || String(window.getSelection())) return;
    field.focus({ preventScroll: true });
  });

  window.addEventListener('popstate', function () { location.reload(); });

  // On the landing page (cat about.md + ls), start at the bottom like a real
  // terminal; re-run once fonts/images settle since they change the height.
  if (normUrl(location.pathname) === normUrl(data.homeUrl)) {
    scrollToBottom();
    window.addEventListener('load', scrollToBottom);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scrollToBottom);
  }

  // Focus the prompt on desktop without jumping to the bottom of long pages
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    field.focus({ preventScroll: true });
  }
})();
