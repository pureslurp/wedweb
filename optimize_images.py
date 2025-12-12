#!/usr/bin/env python3
"""
Image Optimization Script for Wedding Website
Optimizes images in the media/ folder for web use
"""

import os
from pathlib import Path
from PIL import Image
import sys

# Configuration
MEDIA_FOLDER = "media"
MAX_WIDTH = 1920  # Maximum width in pixels
MAX_HEIGHT = 1920  # Maximum height in pixels
QUALITY = 85  # JPEG quality (1-100, higher is better quality)
OUTPUT_SUFFIX = "_optimized"  # Suffix for optimized files (set to "" to overwrite)

def get_file_size(filepath):
    """Get file size in KB"""
    return os.path.getsize(filepath) / 1024

def optimize_image(input_path, output_path):
    """Optimize a single image"""
    try:
        # Open image
        img = Image.open(input_path)
        
        # Get original size
        original_size = get_file_size(input_path)
        original_dimensions = img.size
        
        # Convert RGBA to RGB if necessary (for JPEG)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Resize if too large
        if img.width > MAX_WIDTH or img.height > MAX_HEIGHT:
            img.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.Resampling.LANCZOS)
            print(f"  ↔️  Resized from {original_dimensions[0]}×{original_dimensions[1]} to {img.size[0]}×{img.size[1]}")
        else:
            print(f"  ↔️  Kept original size: {img.size[0]}×{img.size[1]}")
        
        # Save optimized version
        img.save(output_path, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        
        # Get new size
        new_size = get_file_size(output_path)
        savings = ((original_size - new_size) / original_size) * 100
        
        print(f"  💾 Original: {original_size:.1f}KB → Optimized: {new_size:.1f}KB")
        print(f"  ✨ Saved: {savings:.1f}% ({original_size - new_size:.1f}KB)")
        
        return original_size, new_size
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return 0, 0

def main():
    """Main optimization function"""
    print("🎨 Wedding Website Image Optimizer\n")
    print("=" * 50)
    
    # Check if media folder exists
    if not os.path.exists(MEDIA_FOLDER):
        print(f"❌ Error: '{MEDIA_FOLDER}' folder not found!")
        sys.exit(1)
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
    media_path = Path(MEDIA_FOLDER)
    image_files = [f for f in media_path.iterdir() 
                   if f.suffix.lower() in image_extensions 
                   and OUTPUT_SUFFIX not in f.stem]
    
    if not image_files:
        print(f"❌ No images found in '{MEDIA_FOLDER}' folder!")
        sys.exit(1)
    
    print(f"📁 Found {len(image_files)} images to optimize\n")
    
    # Ask for confirmation
    if OUTPUT_SUFFIX:
        print(f"ℹ️  Optimized images will be saved with '{OUTPUT_SUFFIX}' suffix")
        print("   Original images will be kept unchanged\n")
    else:
        response = input("⚠️  WARNING: This will overwrite your original images!\n"
                        "   Make sure you have backups!\n"
                        "   Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Cancelled.")
            sys.exit(0)
    
    # Process each image
    total_original = 0
    total_optimized = 0
    successful = 0
    
    for i, image_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] Processing: {image_file.name}")
        
        # Determine output path
        if OUTPUT_SUFFIX:
            output_name = f"{image_file.stem}{OUTPUT_SUFFIX}{image_file.suffix}"
            output_path = media_path / output_name
        else:
            output_path = image_file
        
        # Optimize
        orig_size, new_size = optimize_image(image_file, output_path)
        
        if orig_size > 0:
            total_original += orig_size
            total_optimized += new_size
            successful += 1
    
    # Summary
    print("\n" + "=" * 50)
    print("✅ Optimization Complete!\n")
    print(f"📊 Summary:")
    print(f"   • Successfully optimized: {successful}/{len(image_files)} images")
    print(f"   • Total original size: {total_original:.1f}KB ({total_original/1024:.1f}MB)")
    print(f"   • Total optimized size: {total_optimized:.1f}KB ({total_optimized/1024:.1f}MB)")
    
    if total_original > 0:
        total_savings = ((total_original - total_optimized) / total_original) * 100
        print(f"   • Total savings: {total_savings:.1f}% ({(total_original - total_optimized)/1024:.1f}MB)")
    
    print("\n🚀 Your images are now optimized for GitHub Pages!")
    
    if OUTPUT_SUFFIX:
        print(f"\nℹ️  Next steps:")
        print(f"   1. Review the optimized images (they have '{OUTPUT_SUFFIX}' in the name)")
        print(f"   2. If satisfied, rename them to remove '{OUTPUT_SUFFIX}'")
        print(f"   3. Delete the original large images")
        print(f"   4. Update photos.html if needed")

if __name__ == "__main__":
    # Check if Pillow is installed
    try:
        from PIL import Image
    except ImportError:
        print("❌ Error: Pillow library not found!")
        print("\nPlease install it with:")
        print("   pip3 install Pillow")
        sys.exit(1)
    
    main()


