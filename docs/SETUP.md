# Parking App — Setup Guide

Follow these steps in order. Each step tells you what to look for and what to copy into `config.js` or GitHub.

---

## Step 1: Find your Tenant ID

You need this first — it's used in both the App Registration and `config.js`.

1. Go to [portal.azure.com](https://portal.azure.com) and sign in with your Sectra admin account
2. Search for **"Microsoft Entra ID"** in the top search bar and open it
3. On the Overview page, copy the **Tenant ID** (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

Open `config.js` and replace `'YOUR_TENANT_ID'` with this value.

---

## Step 2: Create an App Registration

This gives the app permission to read/write the SharePoint list on behalf of users.

1. Still in **Microsoft Entra ID**, click **App registrations** in the left menu
2. Click **+ New registration**
3. Fill in:
   - **Name:** `LeedsParkingApp`
   - **Supported account types:** "Accounts in this organizational directory only"
   - **Redirect URI:** Select **Single-page application (SPA)** from the dropdown, leave the URL blank for now
4. Click **Register**
5. On the overview page that opens, copy the **Application (client) ID**

Open `config.js` and replace `'YOUR_CLIENT_ID'` with this value.

### Add the redirect URI

Once Azure Static Web Apps is set up (Step 4), you'll have a URL like `https://something.azurestaticapps.net`. Come back here and:

1. Click **Authentication** in the left menu
2. Under "Single-page application", click **Add URI**
3. Add: `https://your-swa-url.azurestaticapps.net`
4. Click **Save**

### Grant admin consent for Graph permissions

1. Click **API permissions** in the left menu
2. Click **+ Add a permission → Microsoft Graph → Delegated permissions**
3. Search for and add: **`Sites.ReadWrite.All`**
4. Click **Add permissions**
5. Click **Grant admin consent for [your organisation]** (the button with the green tick)
6. Confirm — the status column should show a green tick saying "Granted"

> ⚠️ You need to be a Global Administrator or have been delegated admin consent rights to do this step.

---

## Step 3: Create the SharePoint List

This is the database where bookings are stored.

1. Go to your Sectra SharePoint site (e.g. `https://yourtenant.sharepoint.com/sites/YourSite`)
2. Click **+ New → List**
3. Choose **Blank list**, name it **`ParkingBookings`**, click **Create**
4. Add these columns (click **+ Add column** for each):

   | Column name | Type |
   |------------|------|
   | `Date` | Date and time |
   | `Space` | Number |
   | `BookedBy` | Single line of text |
   | `BookedByEmail` | Single line of text |

   > The default "Title" column can be left as-is — it won't be used.

5. Open `config.js` and set:
   - `SHAREPOINT_HOSTNAME` — e.g. `'sectrauk.sharepoint.com'`
   - `SHAREPOINT_SITE_PATH` — e.g. `'/sites/LeedsOffice'`

### Find the List ID

1. In the list, click the **Settings cog → List settings**
2. Look at the URL in your browser — it ends with something like `...List=%7Bxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx%7D`
3. Copy that GUID (the part between `%7B` and `%7D`), then decode the `%7B` as `{` and `%7D` as `}` — or just take the `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` part
4. Open `config.js` and replace `'YOUR_LIST_ID'` with this value

---

## Step 4: Create Azure Static Web Apps

This hosts the app on the web.

1. In [portal.azure.com](https://portal.azure.com), search for **"Static Web Apps"** and open it
2. Click **+ Create**
3. Fill in:
   - **Subscription / Resource group:** use your existing Sectra ones, or create a new resource group called `parking-app`
   - **Name:** `LeedsParkingApp`
   - **Plan type:** Free
   - **Region:** UK South (or nearest)
   - **Source:** GitHub
4. Click **Sign in with GitHub** and authorise Azure
5. Select:
   - **Organisation:** `GCarvalho1988`
   - **Repository:** `LeedsParkingApp`
   - **Branch:** `main`
6. Under **Build Details**, set **Build Preset** to `Custom`
   - **App location:** `/`
   - **Output location:** leave blank
7. Click **Review + create → Create**

Azure will automatically add a deploy secret to your GitHub repo and trigger the first deployment.

### Note your SWA URL

Once deployed, the overview page shows a URL like `https://purple-meadow-012345.azurestaticapps.net`. Copy it — you need it for:
- The App Registration redirect URI (Step 2)
- The Teams tab (Step 5)

---

## Step 5: Commit and push `config.js`

Once all the values are filled in:

```bash
git add config.js
git commit -m "config: fill in Azure/SharePoint provisioning values"
git push
```

This will trigger a new deployment automatically.

> ⚠️ `config.js` contains your Client ID and SharePoint details. These are not secret (the app runs in the browser), but avoid committing Tenant ID to public repos. This repo is private so it's fine.

---

## Step 6: Add as a Teams Tab

1. Open Microsoft Teams
2. Go to the team or chat where you want the app, or use the **+ Apps** button on the left sidebar for a personal tab
3. Click **+ Add a tab** (the `+` icon in the tab bar)
4. Click **Add a custom tab** (or search for "Website")
5. Add the SWA URL from Step 4
6. Name it `Parking`
7. Click **Save**

---

## Checklist

- [ ] Tenant ID copied into `config.js`
- [ ] App Registration created, Client ID copied into `config.js`
- [ ] Admin consent granted for `Sites.ReadWrite.All`
- [ ] SharePoint list created with 4 columns
- [ ] SharePoint hostname, site path, and list ID copied into `config.js`
- [ ] Azure Static Web Apps created and deployed
- [ ] Redirect URI added to App Registration
- [ ] `config.js` committed and pushed
- [ ] Teams tab added pointing at SWA URL
