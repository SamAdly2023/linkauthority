# Releasing the WordPress plugin

One-time setup is done: the plugin is approved, ownership is verified via a DNS
TXT record on linkauthority.live, TortoiseSVN is installed, and the working copy
lives at `C:\Users\Sam\Downloads\linkauthority-svn`.

Public page: https://wordpress.org/plugins/linkauthority-partners/
SVN repo:    https://plugins.svn.wordpress.org/linkauthority-partners

## Each release

1. **Bump the version in two places, and make them match.** WordPress serves
   whatever `Stable tag` points at, so a mismatch means users get the wrong code
   or nothing at all.
   - `linkauthority-partners/linkauthority-partners.php` -> `* Version:`
   - `linkauthority-partners/readme.txt` -> `Stable tag:`
   Add a `== Changelog ==` entry while you are there.

2. **Copy the plugin into the working copy.** Contents of
   `linkauthority-partners/` into `linkauthority-svn\trunk\`.

3. **Commit.** Right-click `linkauthority-svn` -> SVN Commit.
   A commit message is mandatory - the server rejects empty ones.
   If files were added or removed, run TortoiseSVN -> Add first.

4. **Tag.** Right-click the `trunk` folder -> TortoiseSVN -> Branch/tag.
   Set **To path** (a path, not a URL - pasting a full URL doubles it):

       /linkauthority-partners/tags/<version>

   Check the "Destination URL" line reads
   `https://plugins.svn.wordpress.org/linkauthority-partners/tags/<version>`
   before confirming. Log message is mandatory here too.

## Notes

- SVN is a release system, not version control. Only commit finished versions;
  day-to-day work belongs in git.
- Never reuse a tag. Each release gets its own.
- `readme.txt` in trunk drives the public page - description, FAQ, changelog.
- Banners and icons live in the top-level `assets/`, never in `trunk/`.
  `trunk/assets/` is the plugin's own CSS and is a different thing entirely.
- Screenshots referenced by `== Screenshots ==` go in the top-level `assets/`
  as `screenshot-1.png`, `screenshot-2.png`, matching the readme order.
