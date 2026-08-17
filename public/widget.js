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

  // scriptTag.src is always resolved to an absolute URL; the raw attribute may be
  // relative or protocol-relative, which would make new URL() throw and kill the
  // whole widget.
  var baseUrl = 'https://www.linkauthority.live';
  try {
    if (scriptTag.src) baseUrl = new URL(scriptTag.src).origin;
  } catch (e) {
    // Keep the default.
  }

  var container = document.getElementById('linkauthority-partners-widget');
  if (!container) {
    container = document.createElement('div');
    container.id = 'linkauthority-partners-widget';
    if (scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  fetch(baseUrl + '/api/integration/partners?token=' + token)
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load partners');
      return response.json();
    })
    .then(function(partners) {
        if (!partners) return;

        var html = '<div class="linkauthority-partners-silo" style="font-family: system-ui, -apple-system, sans-serif; margin: 20px 0; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc; box-sizing: border-box; text-align: left;">';
        html += '<p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; line-height: 1.6;">We are proud to support the following businesses. Take a moment to check out what they do.</p>';

        if (partners.length === 0) {
            html += '<p style="color: #64748b; font-size: 14px; margin: 0;">No businesses listed yet. Check back soon.</p>';
        } else {
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">';
            partners.forEach(function(partner) {
                var title = escapeHtml(partner.title);
                html += '<div class="partner-card" style="border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box;">';
                html += '<div style="margin-bottom: 15px;">';
                html += '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">';
                if (partner.logo) {
                    html += '<img src="' + escapeHtml(partner.logo) + '" alt="' + title + ' logo" loading="lazy" width="36" height="36" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; flex-shrink: 0;">';
                } else {
                    html += '<span aria-hidden="true" style="width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">' + escapeHtml((partner.title || '?').charAt(0)) + '</span>';
                }
                html += '<h3 style="margin: 0; color: #1e293b; font-size: 1.1rem; font-weight: 600;">' + title + '</h3>';
                html += '</div>';
                html += '<p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">' + escapeHtml(partner.description) + '</p>';
                html += '</div>';
                html += '<a href="' + escapeHtml(partner.url) + '" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; text-align: center; transition: background 0.2s;">Visit ' + title + '</a>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '<div style="margin-top: 15px; font-size: 11px; color: #94a3b8; text-align: right;">Site by <a href="' + baseUrl + '" style="color: #2563eb; text-decoration: underline;" target="_blank" rel="noopener">LinkAuthority</a></div>';
        html += '</div>';

        container.innerHTML = html;
    })
    .catch(function(err) {
        console.warn('LinkAuthority Widget Error:', err);
    });
})();
