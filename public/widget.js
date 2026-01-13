(function() {
  // Find the widget script tag more robustly
  var scriptTag = document.currentScript || document.querySelector('script[src*="widget.js"][data-id]');
  
  if (!scriptTag) {
    console.warn('LinkAuthority Widget: Could not locate widget script tag.');
    return;
  }

  var websiteId = scriptTag.getAttribute('data-id');
  if (!websiteId) {
    console.warn('LinkAuthority Widget: data-id attribute missing.');
    return;
  }

  // Determine Base URL from the script src (allows for dev/prod flexibility)
  var src = scriptTag.getAttribute('src');
  var baseUrl = src ? new URL(src).origin : 'https://www.linkauthority.live';

  // Create or Find Container
  var container = document.getElementById('linkauthority-widget');
  if (!container) {
    container = document.createElement('div');
    container.id = 'linkauthority-widget';
    // Insert after script tag if container doesn't exist
    if (scriptTag.parentNode) {
        scriptTag.parentNode.insertBefore(container, scriptTag.nextSibling);
    }
  }

  // Load Links
  fetch(baseUrl + '/api/widget/' + websiteId + '/links')
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to load links');
      return response.json();
    })
    .then(function(links) {
        if (!links || links.length === 0) return;

        var listHtml = '<div style="font-family: sans-serif; margin-top: 20px; padding: 15px; border: 1px solid #eee; border-radius: 8px; background-color: #f9f9f9;">';
        listHtml += '<h4 style="margin: 0 0 10px 0; font-size: 14px; color: #333; font-weight: 600;">Recommended Links</h4>';
        listHtml += '<ul style="list-style: none; padding: 0; margin: 0;">';
        
        links.forEach(function(link) {
            listHtml += '<li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;">';
            listHtml += '<a href="' + link.url + '" rel="dofollow" style="text-decoration: none; color: #2563EB; font-weight: 500; font-size: 14px;" target="_blank">' + (link.text || link.url) + '</a>';
            if (link.description) {
                listHtml += '<p style="margin: 4px 0 0 0; color: #666; font-size: 12px; line-height: 1.4;">' + link.description + '</p>';
            }
            listHtml += '</li>';
        });
        
        listHtml += '</ul>';
        listHtml += '<div style="margin-top: 10px; font-size: 10px; color: #999; text-align: right;">Ads by <a href="' + baseUrl + '" style="color: #999; text-decoration: underline;" target="_blank">LinkAuthority</a></div>';
        listHtml += '</div>';

        container.innerHTML = listHtml;
    })
    .catch(function(err) {
        console.warn('LinkAuthority Widget Error:', err);
    });
})();
