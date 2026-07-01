(function() {
  var scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"][data-token]');
  
  if (!scriptTag) {
    console.warn('LinkAuthority Widget: Could not locate widget script tag.');
    return;
  }

  var token = scriptTag.getAttribute('data-token');
  if (!token) {
    console.warn('LinkAuthority Widget: data-token attribute missing.');
    return;
  }

  var src = scriptTag.getAttribute('src');
  var baseUrl = src ? new URL(src).origin : 'https://www.linkauthority.live';

  var container = document.getElementById('linkauthority-partners-widget');
  if (!container) {
    container = document.createElement('div');
    container.id = 'linkauthority-partners-widget';
    if (scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
    }
  }

  fetch(baseUrl + '/api/integration/links?token=' + token)
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load links');
      return response.json();
    })
    .then(function(links) {
        if (!links) return;

        var html = '<div class="linkauthority-partners-silo" style="font-family: system-ui, -apple-system, sans-serif; margin: 20px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; box-sizing: border-box; text-align: left;">';
        html += '<h2 style="margin: 0 0 20px 0; font-size: 1.5rem; color: #0f172a; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Our SEO Partners</h2>';
        
        if (links.length === 0) {
            html += '<p style="color: #64748b; font-size: 14px; margin: 0;">No partners listed yet.</p>';
        } else {
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">';
            links.forEach(function(link) {
                html += '<div class="partner-card" style="border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box;">';
                html += '<div style="margin-bottom: 15px;">';
                html += '<h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 1.1rem; font-weight: 600;">' + link.title + '</h3>';
                html += '<p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">' + link.description + '</p>';
                html += '</div>';
                html += '<a href="' + link.url + '" rel="dofollow" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; text-align: center; transition: background 0.2s;">Visit Website</a>';
                html += '</div>';
            });
            html += '</div>';
        }
        
        html += '<div style="margin-top: 15px; font-size: 11px; color: #94a3b8; text-align: right;">Powered by <a href="' + baseUrl + '" style="color: #2563eb; text-decoration: underline;" target="_blank">LinkAuthority</a></div>';
        html += '</div>';

        container.innerHTML = html;
    })
    .catch(function(err) {
        console.warn('LinkAuthority Widget Error:', err);
    });
})();
