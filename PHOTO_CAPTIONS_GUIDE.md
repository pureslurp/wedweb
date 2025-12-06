# Photo Captions Guide

Your photo gallery now includes a caption system that displays custom text when users click on photos in the lightbox view.

## 📝 How It Works

All photo captions are stored in a JavaScript dictionary at the top of `photos.html`. The dictionary maps each photo filename to its caption.

## ✏️ How to Edit Captions

1. **Open `photos.html`** in your editor

2. **Find the `photoCaptions` dictionary** near the top of the file (around line 142)

3. **Edit the caption text** between the quotes:

```javascript
const photoCaptions = {
    '02E6D3AA-F9E7-4276-AFF9-C18277CBD7D5.JPG': 'Your caption goes here',
    '0D646A0D-9185-4D4B-9C14-2BD5C68BE3D6.JPG': 'Another caption',
    // ... more photos
};
```

## 💡 Examples

### Simple Caption
```javascript
'02E6D3AA-F9E7-4276-AFF9-C18277CBD7D5.JPG': 'Our first date'
```

### Caption with Emojis
```javascript
'0D646A0D-9185-4D4B-9C14-2BD5C68BE3D6.JPG': 'Beach day ☀️🏖️'
```

### Caption with Date
```javascript
'0F3577B6-D2B2-454A-913C-D8A37831FC13.JPG': 'Christmas 2024 🎄'
```

### Longer Caption
```javascript
'18CA36F3-E6DA-4429-9642-0DAE9323935F.JPG': 'The day Sean proposed at sunset - I said yes!'
```

### Caption with Special Characters
```javascript
'1BED2062-8244-4568-9C19-F6307DB9133F.JPG': "Sean's surprise party (he had no idea!)"
```
*Note: Use single quotes around the caption if it contains an apostrophe*

## 🎨 Caption Tips

### Good Practices:
- ✅ Keep captions concise (1-2 sentences max)
- ✅ Add personal touches and emotions
- ✅ Include dates or locations when relevant
- ✅ Use emojis sparingly for emphasis
- ✅ Be consistent in your style

### Things to Avoid:
- ❌ Very long paragraphs (hard to read in lightbox)
- ❌ All caps (looks like shouting)
- ❌ Too many emojis (distracting)

## 📂 Adding Captions to New Photos

When you add a new photo to the gallery:

1. **Add the photo to the HTML gallery:**
```html
<div class="photo-item">
    <img src="media/gallery/NEW-PHOTO-ID.JPG" alt="Savannah & Sean" loading="lazy">
</div>
```

2. **Add its caption to the dictionary:**
```javascript
const photoCaptions = {
    // ... existing captions ...
    'NEW-PHOTO-ID.JPG': 'Caption for the new photo'
};
```

## 🔍 Finding Photo Filenames

Your current photos are:
- 02E6D3AA-F9E7-4276-AFF9-C18277CBD7D5.JPG
- 0D646A0D-9185-4D4B-9C14-2BD5C68BE3D6.JPG
- 0F3577B6-D2B2-454A-913C-D8A37831FC13.JPG
- 18CA36F3-E6DA-4429-9642-0DAE9323935F.JPG
- 1BED2062-8244-4568-9C19-F6307DB9133F.JPG
- 27BCE06A-8DD5-4256-A3AA-93EE65327677.JPG
- 316CA003-6CBC-4358-8B4D-62B8DEAF3C98.JPG
- 35298CE3-039A-46E6-8907-F287D4547A3A.JPG
- 3566A6FF-5363-4F61-B0FA-871803F34916.JPG
- 39C2105A-CB55-4CCB-B815-8F0D8F2FB212.JPG
- 3BA1B3F4-F9E4-4F03-9CD4-7F24519C3F2D.JPG
- 65F3C2C3-804D-4305-AD64-A5E7737B6FBB.JPG
- 692D6A59-1CD4-4475-B631-3D39C06D0EC0.JPG
- 6A4AA524-8BDB-40FA-AC03-F2500E148019.JPG
- 746EDAE6-9177-4CD8-99B4-7067A3432878.JPG
- 76541675-7BB3-4CF8-AC03-05A359111525.JPG
- 93328CFF-BA66-4289-80F6-8187B0944915.JPG
- 955B2DE1-C7A5-4D70-BC61-C1A3CD4D145B.JPG
- B6417DF1-50BF-4326-87FA-027E502E0A40.JPG
- C7BFAA7E-09D0-4EA9-8A91-6F885EB5DC18.JPG
- E03113B1-A0BD-4062-900B-45F76837A063.JPG
- EF343647-EA25-4433-9544-F33714FF20EB.JPG

## 🎯 Quick Workflow

**Option 1: Edit All Captions at Once**
1. Open a text editor side-by-side with your photos
2. Look at each photo in `media/gallery/`
3. Write the caption for each one
4. Paste them all into the dictionary in `photos.html`

**Option 2: Incremental Editing**
1. Open your website in a browser
2. Click through photos
3. Note which ones need better captions
4. Edit the dictionary
5. Refresh and check again

## 🔄 Testing Your Captions

1. Save `photos.html`
2. Refresh your website
3. Click on photos to see captions in the lightbox
4. Check for:
   - Typos or grammar issues
   - Appropriate length
   - Consistent style
   - Correct photo-caption pairing

## 💾 Default Behavior

If a photo doesn't have a caption in the dictionary, it will display:
```
"Savannah & Sean"
```

This ensures every photo always has something displayed.

## 🚀 Advanced: Dynamic Caption System

If you want to get fancy, you could organize captions by category:

```javascript
const photoCaptions = {
    // Proposal Photos
    '02E6D3AA-F9E7-4276-AFF9-C18277CBD7D5.JPG': 'The moment I said yes! 💍',
    '0D646A0D-9185-4D4B-9C14-2BD5C68BE3D6.JPG': 'He was so nervous!',
    
    // Vacation Photos
    '0F3577B6-D2B2-454A-913C-D8A37831FC13.JPG': 'Hawaii 2024 🌺',
    '18CA36F3-E6DA-4429-9642-0DAE9323935F.JPG': 'Sunset at the beach',
    
    // Family Events
    '1BED2062-8244-4568-9C19-F6307DB9133F.JPG': 'Thanksgiving with the family',
    // ... etc
};
```

## 📞 Need Help?

- **Can't find the dictionary?** Search for `photoCaptions` in `photos.html`
- **Caption not showing?** Check that the filename exactly matches (including .JPG)
- **Syntax error?** Make sure each line ends with a comma except the last one
- **Special characters not working?** Try using double quotes instead of single quotes

---

**Happy captioning! 📸✨**

