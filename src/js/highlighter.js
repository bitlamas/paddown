/**
 * Paddown — Syntax highlighter
 * Character-level tagging to avoid overlapping spans.
 * Token colors match Claude's inline styles exactly.
 * Supports: JavaScript, Python, HTML, CSS, Bash, JSON, SQL, PHP.
 */
window.Paddown = window.Paddown || {};

window.Paddown.highlighter = (() => {
  const { escapeHtml } = window.Paddown.utils;

  const RULES = {
    javascript: [
      { pattern: /(\/\/[^\n]*)/g,                                  cls: 'tok-comment'  },
      { pattern: /(\/\*[\s\S]*?\*\/)/g,                            cls: 'tok-comment'  },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,        cls: 'tok-string'   },
      { pattern: /(`(?:[^`\\]|\\.)*`)/g,                           cls: 'tok-tmpl'     },
      { pattern: /\b(function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|class|new|this|import|export|from|of|in|typeof|instanceof|true|false|null|undefined|async|await|throw|try|catch|finally|default|void|delete|yield)\b/g, cls: 'tok-keyword' },
      { pattern: /\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,         cls: 'tok-number'   },
      { pattern: /([{}[\]();,])/g,                                 cls: 'tok-punct'    },
      { pattern: /(=>|[+\-*/%=&|<>!~^?:]+)/g,                     cls: 'tok-operator' },
      { pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,       cls: 'tok-fn'       },
    ],

    python: [
      { pattern: /(#[^\n]*)/g,                                     cls: 'tok-comment'  },
      { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g,               cls: 'tok-string'   },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,        cls: 'tok-string'   },
      { pattern: /\b(def|return|if|elif|else|for|while|class|import|from|as|in|not|and|or|is|True|False|None|pass|break|continue|with|yield|lambda|try|except|finally|raise|print|global|nonlocal|assert|del)\b/g, cls: 'tok-keyword' },
      { pattern: /\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,         cls: 'tok-number'   },
      { pattern: /([{}[\]();,:])/g,                                cls: 'tok-punct'    },
      { pattern: /([+\-*/%=&|<>!~^@]+)/g,                         cls: 'tok-operator' },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,         cls: 'tok-fn'       },
    ],

    html: [
      { pattern: /(<!--[\s\S]*?-->)/g,                             cls: 'tok-comment'  },
      { pattern: /(<\/?)([a-zA-Z][a-zA-Z0-9-]*)/g,                cls: 'tok-keyword'  },
      { pattern: /(\s)([a-zA-Z-]+)(=)/g,                          cls: 'tok-fn'       },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,        cls: 'tok-string'   },
      { pattern: /(&[a-zA-Z]+;|&#\d+;)/g,                         cls: 'tok-number'   },
      { pattern: /([<>\/=])/g,                                     cls: 'tok-punct'    },
    ],

    css: [
      { pattern: /(\/\*[\s\S]*?\*\/)/g,                            cls: 'tok-comment'  },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,        cls: 'tok-string'   },
      { pattern: /(@[a-zA-Z-]+)/g,                                 cls: 'tok-keyword'  },
      { pattern: /(!important)/g,                                  cls: 'tok-keyword'  },
      { pattern: /(#[a-fA-F0-9]{3,8})\b/g,                        cls: 'tok-number'   },
      { pattern: /\b(\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|fr|s|ms|deg)?)\b/g, cls: 'tok-number' },
      { pattern: /([{}();:,])/g,                                   cls: 'tok-punct'    },
      { pattern: /([.#][a-zA-Z_-][a-zA-Z0-9_-]*)/g,               cls: 'tok-fn'       },
      { pattern: /\b([a-zA-Z-]+)\s*(?=:)/g,                       cls: 'tok-fn'       },
    ],

    bash: [
      { pattern: /(#[^\n]*)/g,                                     cls: 'tok-comment'  },
      { pattern: /("(?:[^"\\]|\\.)*"|'[^']*')/g,                  cls: 'tok-string'   },
      { pattern: /(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]+\})/g,      cls: 'tok-tmpl'     },
      { pattern: /\b(if|then|else|elif|fi|for|do|done|while|until|case|esac|in|function|return|local|export|source|alias|unset|set|shift|exit|echo|printf|read|test|cd|ls|grep|sed|awk|cat|mkdir|rm|cp|mv|chmod|chown|sudo|apt|yum|pip|npm)\b/g, cls: 'tok-keyword' },
      { pattern: /\b(\d+(?:\.\d+)?)\b/g,                          cls: 'tok-number'   },
      { pattern: /([|&;<>(){}[\]])/g,                              cls: 'tok-punct'    },
      { pattern: /([=!<>+\-]+)/g,                                  cls: 'tok-operator' },
    ],

    json: [
      { pattern: /("(?:[^"\\]|\\.)*")\s*(?=:)/g,                  cls: 'tok-fn'       },
      { pattern: /("(?:[^"\\]|\\.)*")/g,                           cls: 'tok-string'   },
      { pattern: /\b(true|false|null)\b/g,                         cls: 'tok-keyword'  },
      { pattern: /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,           cls: 'tok-number'   },
      { pattern: /([{}[\]:,])/g,                                   cls: 'tok-punct'    },
    ],

    sql: [
      { pattern: /(--[^\n]*)/g,                                    cls: 'tok-comment'  },
      { pattern: /(\/\*[\s\S]*?\*\/)/g,                            cls: 'tok-comment'  },
      { pattern: /('(?:[^'\\]|\\.)*')/g,                           cls: 'tok-string'   },
      { pattern: /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|VIEW|GRANT|REVOKE|UNION|ALL|DISTINCT|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|ASC|DESC|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MAX|MIN|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CONSTRAINT|UNIQUE|CHECK|IF|BEGIN|COMMIT|ROLLBACK|TRUNCATE|WITH|RECURSIVE)\b/gi, cls: 'tok-keyword' },
      { pattern: /\b(\d+(?:\.\d+)?)\b/g,                          cls: 'tok-number'   },
      { pattern: /([();,.*])/g,                                    cls: 'tok-punct'    },
      { pattern: /([=<>!+\-]+)/g,                                  cls: 'tok-operator' },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,         cls: 'tok-fn'       },
    ],

    php: [
      { pattern: /(\/\/[^\n]*|#[^\n]*)/g,                          cls: 'tok-comment'  },
      { pattern: /(\/\*[\s\S]*?\*\/)/g,                            cls: 'tok-comment'  },
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,        cls: 'tok-string'   },
      { pattern: /(\$[a-zA-Z_][a-zA-Z0-9_]*)/g,                   cls: 'tok-tmpl'     },
      { pattern: /\b(function|return|if|else|elseif|for|foreach|while|do|switch|case|break|continue|class|new|this|public|private|protected|static|abstract|interface|extends|implements|namespace|use|require|include|require_once|include_once|echo|print|array|true|false|null|try|catch|finally|throw|const|var|match|fn|yield|enum)\b/g, cls: 'tok-keyword' },
      { pattern: /\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g,         cls: 'tok-number'   },
      { pattern: /([{}[\]();,])/g,                                 cls: 'tok-punct'    },
      { pattern: /(=>|->|[+\-*/%=&|<>!~^.?:]+)/g,                cls: 'tok-operator' },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,         cls: 'tok-fn'       },
    ]
  };

  // Language aliases
  const ALIASES = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'javascript',
    tsx: 'javascript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    htm: 'html',
    xml: 'html',
    svg: 'html',
    scss: 'css',
    sass: 'css',
    less: 'css',
    mysql: 'sql',
    pgsql: 'sql',
    postgresql: 'sql',
    sqlite: 'sql',
    jsonc: 'json'
  };

  function highlight(code, lang) {
    const resolved = ALIASES[lang] || lang;
    const rules = RULES[resolved];
    if (!rules) return escapeHtml(code);

    const src = code;
    const len = src.length;
    const tags = new Array(len).fill(null);

    for (const { pattern, cls } of rules) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(src)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        let clean = true;
        for (let i = start; i < end; i++) {
          if (tags[i] !== null) { clean = false; break; }
        }
        if (clean) {
          for (let i = start; i < end; i++) {
            tags[i] = i === start ? { cls, len: m[0].length } : 'taken';
          }
        }
      }
    }

    let html = '';
    let i = 0;
    while (i < len) {
      const tag = tags[i];
      if (tag && tag !== 'taken') {
        const raw = src.slice(i, i + tag.len);
        html += `<span class="${tag.cls}">${escapeHtml(raw)}</span>`;
        i += tag.len;
      } else {
        html += escapeHtml(src[i]);
        i++;
      }
    }
    return html;
  }

  return { highlight, RULES, ALIASES };
})();
