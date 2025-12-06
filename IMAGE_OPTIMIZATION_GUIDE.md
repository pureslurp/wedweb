# Image Optimization Guide for GitHub Pages

Your website will be hosted on GitHub Pages, which has storage and bandwidth limits. By optimizing your photos, you'll make your site:
- ✅ Load faster
- ✅ Use less bandwidth
- ✅ Work better on mobile devices
- ✅ Stay well within GitHub's limits

## 📏 Recommended Image Specs

- **Width:** 1920px max (1200px is usually plenty)
- **Quality:** 80-85% JPEG quality
- **File Size:** 100-300KB per photo
- **Format:** JPEG (or WebP with JPEG fallback)

## 🛠️ Option 1: Online Tools (Easiest)

### TinyPNG (Recommended)
1. Go to [tinypng.com](https://tinypng.com)
2. Drag and drop your photos
3. Download optimized versions
4. Save to `media/` folder

**Pros:** Simple, no installation, excellent compression

### Squoosh (Google)
1. Go to [squoosh.app](https://squoosh.app)
2. Upload photo
3. Adjust quality (80-85%)
4. Resize if needed
5. Download

**Pros:** More control, side-by-side comparison

## 🖥️ Option 2: Batch Processing (Faster for Many Photos)

I've created a Python script for you that will automatically optimize all photos!

### Using the Optimization Script

1. **Install Pillow (if you don't have it):**
   ```bash
   pip3 install Pillow
   ```

2. **Run the script:**
   ```bash
   python3 optimize_images.py
   ```

3. **The script will:**
   - Find all images in the `media/` folder
   - Resize them to max 1920px wide
   - Compress to 85% quality
   - Save optimized versions
   - Show you the size savings!

## 📊 Expected Results

### Before Optimization:
- 50 photos × 3MB = **150MB**
- Slow loading on mobile
- Uses lots of bandwidth

### After Optimization:
- 50 photos × 200KB = **10MB**
- Fast loading everywhere
- Minimal bandwidth usage

## 💾 GitHub Pages Considerations

### You're Safe If:
- ✅ Total repository under 500MB
- ✅ Photos optimized for web
- ✅ Less than 100 photos

### You Might Have Issues If:
- ❌ Repository over 1GB
- ❌ Using original camera photos
- ❌ Hundreds of high-res photos

### Current Estimate for Your Site:
- Code files: ~50KB
- 5 current photos (unoptimized): ~10MB
- **If you add 50 more optimized photos: ~20MB total** ✅ Perfect!

## 🎨 Maintaining Image Quality

Don't worry! Optimized doesn't mean low quality. Here's what visitors will see:
- Photos will look crisp and professional
- No visible quality loss on screens
- Much faster loading times
- Better mobile experience

## 🚀 Pro Tips

1. **Use descriptive filenames:**
   - Good: `ceremony-first-kiss.jpg`
   - Bad: `IMG_9847.jpg`

2. **Keep originals elsewhere:**
   - Store full-res originals on Google Photos or iCloud
   - Only upload optimized versions to GitHub

3. **Lazy loading (already implemented!):**
   - Your photos already use `loading="lazy"`
   - This means photos only load when visible
   - Faster initial page load

4. **Progressive JPEG:**
   - Shows a low-res preview while loading
   - Our optimization script creates these automatically

## 📱 Mobile Considerations

Your site is responsive, but large images hurt mobile users:
- **Unoptimized:** 3MB × 50 photos = 150MB download 😱
- **Optimized:** 200KB × 50 photos = 10MB download 😊

Mobile users often have:
- Limited data plans
- Slower connections
- Less patience for slow sites

## 🔍 How to Check Your Current Images

Run this command to see your current image sizes:
```bash
ls -lh media/
```

Or check the total size:
```bash
du -sh media/
```

## 📈 Monitoring Your GitHub Repository

Check your repo size:
```bash
git count-objects -vH
```

If you're ever concerned, GitHub will warn you before any issues.

## ✨ Summary

**Best Approach:**
1. Use the `optimize_images.py` script (I've created it for you)
2. Or use TinyPNG for smaller batches
3. Keep optimized photos under 300KB each
4. You'll easily host 50-100 photos on GitHub Pages

**Bottom Line:** With optimized images, you can have a beautiful photo gallery with 50+ photos and stay well within GitHub Pages limits! 🎉

