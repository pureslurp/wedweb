# Photo Album Integration Guide

This guide will help you set up your Photos page to automatically display photos from a shared album.

## 📸 Recommended Option: Google Photos

**Why Google Photos?**
- ✅ Free and unlimited for high-quality photos
- ✅ Easy sharing with family and friends
- ✅ Automatic syncing when new photos are added
- ✅ Works on all devices
- ✅ Can allow guests to contribute photos

**⚠️ Important Note:** Google Photos doesn't allow direct embedding in websites (for security reasons). However, we've created a beautiful link button that opens your album! For photos directly on your page, use the manual photo grid.

### Setup Instructions:

1. **Create a Google Photos Album**
   - Go to [photos.google.com](https://photos.google.com)
   - Click "Albums" in the left sidebar
   - Click "Create Album"
   - Add your photos to the album
   - Give it a name (e.g., "Savannah & Sean - Our Journey")

2. **Get the Share Link**
   - Open your album in Google Photos
   - Click the "Share" button (top right)
   - Turn on link sharing by clicking "Get link" or "Create link"
   - Copy the link (it will look like: `https://photos.app.goo.gl/xxxxxx`)

3. **Add the Link to Your Website**
   - Open `photos.html` in your editor
   - Find the line: `const GOOGLE_PHOTOS_ALBUM_LINK = 'YOUR_GOOGLE_PHOTOS_ALBUM_LINK';` (appears twice)
   - Replace `YOUR_GOOGLE_PHOTOS_ALBUM_LINK` with your actual link in BOTH places
   - Example: `const GOOGLE_PHOTOS_ALBUM_LINK = 'https://photos.app.goo.gl/abc123xyz';`
   - Save the file

4. **Test Your Page**
   - Open `photos.html` in your browser
   - You should see a beautiful card that links to your Google Photos album!
   - Click it to open the full album in a new tab

### Tips:
- Anyone with the link can view the album
- Enable "Collaboration" in Google Photos so guests can add their own photos!
- For photos displayed directly on your page, use the manual photo grid (see below)

---

## 🍎 Alternative Option: iCloud Shared Album

**Note:** iCloud albums cannot be embedded directly, but you can link to them.

### Setup Instructions:

1. **Create a Shared Album**
   - Open Photos app on iPhone/iPad/Mac
   - Go to "Shared Albums"
   - Tap "+" to create a new shared album
   - Add photos and invite people

2. **Get the iCloud Link**
   - Open the shared album
   - Click/tap the "Share" icon
   - Choose "Copy iCloud Link"

3. **Add to Your Website**
   - In `photos.html`, find: `const GOOGLE_PHOTOS_ALBUM_LINK = 'YOUR_GOOGLE_PHOTOS_ALBUM_LINK';`
   - Replace with your iCloud link
   - Note: This will open iCloud Photos in a new tab (not embedded)

---

## 📷 Alternative Option: Instagram Embed

If you're sharing photos on Instagram, you can embed posts!

### Option A: Single Post
```html
<blockquote class="instagram-media" data-instgrm-permalink="YOUR_POST_URL">
</blockquote>
<script async src="//www.instagram.com/embed.js"></script>
```

### Option B: Instagram Profile Widget
Use a service like [SnapWidget](https://snapwidget.com/) or [Behold](https://behold.so/) to create an Instagram gallery widget.

---

## 🌐 Alternative Option: Flickr

1. Create a Flickr album at [flickr.com](https://www.flickr.com)
2. Share the album and get the embed code
3. Add the embed code to `photos.html`

---

## 🖼️ Alternative Option: Manual Upload

If you prefer to upload photos directly to your website:

1. **Add Photos to `/media/` Folder**
   - Save your photos in the `media` folder
   - Name them: `photo1.jpg`, `photo2.jpg`, etc.

2. **Edit photos.html**
   - Find the commented section: `<!-- OPTION 2: Manual Photo Grid -->`
   - Uncomment that section (remove `<!--` and `-->`)
   - Add more photo items as needed:
   ```html
   <div class="photo-item">
       <img src="media/photo1.jpg" alt="Description" loading="lazy">
   </div>
   ```

3. **Hide the Google Photos Section**
   - Comment out or delete the Google Photos container section

---

## 🎨 Customization Options

### Change the Grid Layout
In `styles.css`, find `.photo-grid` and modify:
```css
.photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
}
```
- Change `300px` to make grid items larger/smaller
- Change `1.5rem` to adjust spacing between photos

### Change Colors
Modify these variables in `styles.css`:
- Primary color: `#8b7355` (brown/tan)
- Background: `#faf9f7` (cream)

---

## 🔒 Privacy Considerations

- **Google Photos**: Anyone with the link can view the album
- **iCloud**: Can control who can view and contribute
- **Manual Upload**: Fully public once on your website
- **Instagram**: Public unless your account is private

---

## ❓ Troubleshooting

### Google Photos album not showing?
1. Make sure sharing is enabled in Google Photos
2. Check that the link is correct in `photos.html`
3. Try opening the link in a new browser tab to verify it works

### Photos not displaying correctly?
1. Clear your browser cache
2. Make sure image files are in the correct folder
3. Check file names and paths in the HTML

### Want to add a lightbox (click to enlarge)?
Consider adding a library like:
- [PhotoSwipe](https://photoswipe.com/)
- [Lightbox2](https://lokeshdhakar.com/projects/lightbox2/)
- [GLightbox](https://biati-digital.github.io/glightbox/)

---

## 📞 Need Help?

If you need assistance setting up your photo album, feel free to reach out!

---

**Happy photo sharing! 📸✨**

