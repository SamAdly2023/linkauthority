import React from 'react';
import { BookOpen, CheckCircle, Zap, Globe, Code, AlertTriangle, RefreshCw } from 'lucide-react';

const UserGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 p-8 border border-white/10 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">LinkAuthority User Guide</h1>
          <p className="text-blue-200 text-lg">
            Add a website, activate it, and you are automatically featured on the Business Partners page
            of every other active site in the network &mdash; with a real dofollow link back to you.
            Free while we grow.
          </p>
        </div>
        <BookOpen className="absolute -right-10 -bottom-10 text-white/5 w-64 h-64" />
      </div>

      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-start gap-4">
        <Zap className="text-green-400 shrink-0 mt-0.5" size={22} />
        <div>
          <h2 className="text-white font-bold mb-1">Everything is free right now</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            No plans, no credit card, no limits on how many websites you add. The network only works if
            there are plenty of sites in it, so we are keeping it free while it grows. You will get plenty
            of notice before that ever changes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="text-green-500" /> 1. Getting started
          </h2>
          <ol className="space-y-3 text-slate-300 text-sm">
            <li className="flex gap-2">
              <span className="font-bold text-white shrink-0">1.</span>
              <span>Sign in with Google. That is the whole signup.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-white shrink-0">2.</span>
              <span>Go to <strong className="text-white">My Websites</strong> and add a domain. Every niche is welcome.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-white shrink-0">3.</span>
              <span>Add a logo and a short description in the gear menu. These appear on your card on other members&rsquo; sites, so a good description earns better clicks.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-white shrink-0">4.</span>
              <span>Click <strong className="text-white">Integration</strong> and connect the site using one of the two methods below.</span>
            </li>
          </ol>
        </div>

        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Globe className="text-blue-500" /> 2. What activation does
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-3">
            The moment your site connects, two things happen at once:
          </p>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">&bull;</span>
              <span>Your business is added to the Business Partners page of every other active site in the network.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 shrink-0">&bull;</span>
              <span>Your own Business Partners page fills up with every other member.</span>
            </li>
          </ul>
          <p className="text-slate-400 text-xs leading-relaxed mt-3">
            Links are ordinary dofollow links and open in the same tab. Every page carries Schema.org
            structured data describing the businesses listed on it.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-yellow-400" /> 3. WordPress sites &mdash; the plugin
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          One plugin works on every site you own. Download it once and reuse the same file everywhere;
          the site token is what tells it which website it belongs to.
        </p>
        <ol className="space-y-3 text-slate-300 text-sm">
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">1.</span>
            <span>In <strong className="text-white">Integration</strong>, click <strong className="text-white">Download WP Plugin</strong>, and copy the site token shown underneath it.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">2.</span>
            <span>In WordPress: Plugins &rarr; Add New &rarr; Upload Plugin, choose the zip, install and activate.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">3.</span>
            <span>Open <strong className="text-white">LinkAuthority</strong> in the WordPress sidebar, paste the token, and save. That connects the site.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">4.</span>
            <span>Click <strong className="text-white">Create the Business Partners page</strong>, or drop <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 text-xs">[linkauthority_partners]</code> onto any page you already have.</span>
          </li>
        </ol>
        <p className="text-slate-400 text-xs leading-relaxed mt-4">
          The page updates itself &mdash; hourly, and immediately whenever a business joins or leaves.
          Nothing is written into your page content, so your own copy is never overwritten.
        </p>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Code className="text-indigo-400" /> 4. Everything else &mdash; the JavaScript snippet
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          For Shopify, Webflow, Squarespace, custom builds or anything that is not WordPress.
        </p>
        <ol className="space-y-3 text-slate-300 text-sm">
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">1.</span>
            <span>Create a page on your site &mdash; something like <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 text-xs">/partners</code>. The snippet does not create one for you.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">2.</span>
            <span>Paste the snippet from <strong className="text-white">Integration</strong> into that page. It already contains your site token &mdash; that is what identifies your website, so use the snippet from the right site.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-white shrink-0">3.</span>
            <span>Publish the page, then click <strong className="text-white">Verify JS Integration</strong>. If your page is not at <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300 text-xs">/partners</code>, paste its full URL in the box first.</span>
          </li>
        </ol>
        <p className="text-slate-400 text-xs leading-relaxed mt-4">
          The snippet renders the directory live on every page load, so it stays current without a plugin
          or a cron job.
        </p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="text-amber-400" /> 5. Keeping your listing
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          The network runs on reciprocity: you are featured on other members&rsquo; sites for as long as
          you are featuring them. Keep these true and your listing stays live.
        </p>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">&bull;</span>
            <span>
              <strong className="text-white">Leave the plugin active.</strong> Deactivating or deleting it
              disconnects your site immediately and removes your links from every other member&rsquo;s page.
              Reactivating puts them straight back.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">&bull;</span>
            <span>
              <strong className="text-white">Keep the Business Partners page published.</strong> Trashing
              it, or removing the shortcode, means you stop hosting the network even though you are still
              listed on it.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">&bull;</span>
            <span>
              <strong className="text-white">Do not add nofollow.</strong> The links are dofollow by design.
              Blocking the page in robots.txt has the same effect as not having it.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">&bull;</span>
            <span>
              <strong className="text-white">Run one integration per site.</strong> Do not leave an old copy
              of the plugin active alongside a new one &mdash; they compete and the older one can win.
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <RefreshCw className="text-blue-400" /> 6. Troubleshooting
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-bold text-white mb-1">My page is empty</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              The token has not been saved yet. Open the LinkAuthority menu in WordPress and check the
              status row reads &ldquo;Connected and listed&rdquo;.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-1">My logo is not showing</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              The logo URL has to be a direct link to the image file itself. A Google Drive or Dropbox
              share link will not render. The preview in the gear menu tells you straight away.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-1">A change has not appeared yet</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Edits push out immediately, but if a site was offline it picks them up on its next hourly
              sync. Refresh Now in the WordPress menu forces it.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-1">I see raw CSS on the page</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              That is an old plugin version. Delete it, install the current one from Integration, and
              replace the page content with the shortcode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserGuide;
