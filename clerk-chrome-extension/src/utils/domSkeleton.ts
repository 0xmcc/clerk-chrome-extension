export const getDomSkeleton = (root: Element = document.body): string => {
    // 1. Clone to avoid mutating live DOM
    const clone = root.cloneNode(true) as Element;
  
    // 2. Remove noise (scripts, styles, SVGs, images, iframes)
    const trash = clone.querySelectorAll('script, style, svg, img, iframe, noscript');
    trash.forEach(el => el.remove());
  
    // 3. Walk the tree to strip text and sensitive attributes
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    
    while (walker.nextNode()) {
      const el = walker.currentNode as Element;
      
      // STRIP TEXT: Replace content with a length marker
      // We keep the length because "long text" usually means "message body"
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
         const len = el.textContent?.length || 0;
         el.textContent = `[TEXT_${len}_CHARS]`;
      }
  
      // STRIP ATTRIBUTES: Keep only structural ones
      const keepAttrs = ['class', 'id', 'data-testid', 'role', 'aria-label'];
      [...el.attributes].forEach(attr => {
        if (!keepAttrs.includes(attr.name) && !attr.name.startsWith('data-')) {
          el.removeAttribute(attr.name);
        }
      });
    }
  
    // 4. Return the clean HTML string
    return clone.innerHTML;
  }