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
   `linkauthority-partners/` into `linkauthority-svn\trunk\`. Empty `trunk\`
   first, so a file removed from the plugin does not live on in the release.

3. **Commit.** Right-click `linkauthority-svn` -> SVN Commit.
   A commit message is mandatory - the server rejects empty ones.
   If files were added or removed, run TortoiseSVN -> Add first.

4. **Tag.** Right-click the `trunk` folder -> TortoiseSVN -> Branch/tag.
   Set **To path** (a path, not a URL - pasting a full URL doubles it):

       /linkauthority-partners/tags/<version>

   Check the "Destination URL" line reads
   `https://plugins.svn.wordpress.org/linkauthority-partners/tags/<version>`
   before confirming. Log message is mandatory here too.

## Building a zip by hand

Only needed for testing an install. WordPress.org takes its releases from SVN,
never from a zip.

Do **not** use PowerShell's `Compress-Archive`: it writes backslash path
separators, which the ZIP spec does not allow, so a Linux host unpacks the
plugin as a single file called `linkauthority-partners\readme.txt`. Use the zip
writer already in the repo:

```bash
node -e "const Z=require('./server/node_modules/adm-zip');const z=new Z();z.addLocalFolder('linkauthority-partners','linkauthority-partners');z.writeZip('linkauthority-partners-1.3.0.zip')"
```

The zip the website serves at `/api/wp/plugin` is built server-side in
`server/routes/integrationRoutes.js` and always matches what is deployed, so it
never needs building by hand.

## Notes

- SVN is a release system, not version control. Only commit finished versions;
  day-to-day work belongs in git.
- Never reuse a tag. Each release gets its own.
- `readme.txt` in trunk drives the public page - description, FAQ, changelog.
- Banners and icons live in the top-level `assets/`, never in `trunk/`.
  `trunk/assets/` is the plugin's own CSS and is a different thing entirely.
- Screenshots referenced by `== Screenshots ==` go in the top-level `assets/`
  as `screenshot-1.png`, `screenshot-2.png`, matching the readme order.
