/* Marked is used only as a tokenizer. Model text never enters an HTML sink.
   Unsupported tokens (including raw HTML and images) are displayed as text. */
function renderMarkdown(text) {
  const fragment = document.createDocumentFragment();
  function render(tokens, parent) {
    for (const token of tokens) {
      let node;
      switch (token.type) {
        case 'space': continue;
        case 'paragraph': node = document.createElement('p'); break;
        case 'heading': node = document.createElement('h3'); break;
        case 'strong': node = document.createElement('strong'); break;
        case 'em': node = document.createElement('em'); break;
        case 'del': node = document.createElement('s'); break;
        case 'blockquote': node = document.createElement('blockquote'); break;
        case 'br': node = document.createElement('br'); break;
        case 'hr': node = document.createElement('hr'); break;
        case 'code':
          node = document.createElement('pre');
          node.appendChild(document.createElement('code')).textContent = token.text;
          parent.append(node);
          continue;
        case 'codespan':
          node = document.createElement('code');
          node.textContent = token.text;
          parent.append(node);
          continue;
        case 'list':
          node = document.createElement(token.ordered ? 'ol' : 'ul');
          if (token.ordered && Number.isSafeInteger(token.start)) node.start = token.start;
          for (const item of token.items) {
            const li = document.createElement('li');
            render(item.tokens, li);
            node.append(li);
          }
          parent.append(node);
          continue;
        case 'link': {
          // URL parsing and a protocol allowlist, never regex HTML sanitization.
          let url;
          try { url = new URL(token.href, location.href); } catch { /* plain label */ }
          node = document.createElement(url && ['https:', 'http:'].includes(url.protocol) ? 'a' : 'span');
          if (node.tagName === 'A') {
            node.href = url.href;
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
            node.referrerPolicy = 'no-referrer';
          }
          break;
        }
        case 'text':
          if (token.tokens) { render(token.tokens, parent); continue; }
          parent.append(document.createTextNode(token.text));
          continue;
        default:
          parent.append(document.createTextNode(token.raw ?? token.text ?? ''));
          continue;
      }
      if (token.tokens) render(token.tokens, node);
      else if (token.text) node.textContent = token.text;
      parent.append(node);
    }
  }
  try { render(marked.lexer(text, { gfm: true }), fragment); }
  catch { fragment.replaceChildren(document.createTextNode(text)); }
  return fragment;
}
