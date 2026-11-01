# EduPulse for Microsoft Teams

This folder contains the Microsoft Teams **Personal App** package configuration for EduPulse.

## App details

- App name: EduPulse
- Scope: `personal`
- Hosted app: https://camhv12.github.io/edupulse/
- Manifest: `manifest.json`
- Domain allow-list: `camhv12.github.io`

## Build the Teams app package

The Teams app package is a ZIP containing exactly these three files at the ZIP root:

- `manifest.json`
- `icon-color.png`
- `icon-outline.png`

From this folder in PowerShell:

```powershell
Compress-Archive -Path manifest.json, icon-color.png, icon-outline.png -DestinationPath ..\EduPulse-Teams.zip -Force
```

Do not zip the parent `teams` folder itself; the three files must be at the ZIP root.

## Install for testing

1. Open Microsoft Teams.
2. Select **Apps** > **Manage your apps** > **Upload an app** > **Upload a custom app**.
3. Select `EduPulse-Teams.zip`.
4. Review the app details and select **Add**.
5. Open EduPulse from **View more apps** / the left app rail and optionally pin it.

If **Upload a custom app** is unavailable, ask the Teams administrator to enable custom app upload for the tenant.

## Make it available to everyone

Uploading the package as an individual only installs it for that user. To make EduPulse available to all users, a Teams administrator must:

1. Open the Teams admin center: https://admin.teams.microsoft.com/
2. Go to **Teams apps** > **Manage apps**.
3. Upload or locate EduPulse and publish/allow it according to the tenant's app policies.
4. Use **Setup policies** (or app-centric management, if enabled in the tenant) to install and/or pin EduPulse for the intended users or the whole organization.

Tenant policy changes require Teams administrator permissions and may take time to propagate.

## Embedding note

Teams renders a personal tab inside an iframe. The hosted page must permit framing by Teams and must initialize the Teams JavaScript client SDK. GitHub Pages does not provide per-project response-header configuration. If the browser console reports an `X-Frame-Options` or `Content-Security-Policy frame-ancestors` block, move the static site to a host where those response headers can be configured to allow Teams, such as Azure Static Web Apps or Cloudflare Pages.

## Troubleshooting

- Blank tab: check iframe response headers and the browser console.
- App rejected: validate the manifest JSON and ensure the ZIP contains the three files at its root.
- Users cannot find the app: check the tenant's app permission and setup policies.
