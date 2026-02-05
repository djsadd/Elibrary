# Quick Article Upload - Visual Guide & Getting Started

## 🎯 Quick Start (5 minutes)

### Step 1: Access the Form
```
Admin Dashboard → Click "⚡ Quick Article" button
                OR
Left Sidebar → Click "⚡ Quick Article" 
                OR
Navigate to: /admin/articles/quick
```

### Step 2: Fill Essential Info (Required)
```
┌─────────────────────────────────────┐
│ 📝 Article Title *                  │
│ [Enter title here...]               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📄 PDF File                         │
│ [Click to upload or drag & drop]    │
│ Shows: filename.pdf (2.5 MB)        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📦 Format                           │
│ ☑ EBOOK                            │
│ ☐ AUDIOBOOK                        │
│ ☐ VIDEOBOOK                        │
│ ☐ ARTICLE                          │
└─────────────────────────────────────┘
```

### Step 3: Add Details (Optional)
```
Year:           [2024]
Language:       [Russian ▼]
ISBN:           [978-...]
Edition:        [1st edition]
Page Count:     [150]
Available:      [1]
Description:    [Brief summary...]
```

### Step 4: Classify Content (Optional)
```
Authors: [Search or type to add...]
         - Author 1 ✓
         - Author 2 ✓
         [+ Add new author]

Categories: [Search or type to add...]
            - Technology ✓
            - Education ✓
            [+ Add new category]
```

### Step 5: Upload Cover (Optional)
```
Cover Image:
[Click to upload or drag & drop]
Supports: PNG, JPG, WEBP
```

### Step 6: Submit
```
☑ Public Access (make visible to all)
                 OR  ↓
[Cancel]         [🚀 Create Article]
```

### Step 7: Success!
```
✅ Article created successfully!
   Redirecting to admin dashboard...
```

---

## 📊 Form Layout

### Desktop View (1200px+)
```
┌─────────────────────────────────────────────────────────────┐
│                    ⚡ QUICK ARTICLE UPLOAD                   │
│        Quickly upload articles and materials to the        │
│              catalogue with minimal information             │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│  SECTION 1: ESSENTIAL        │                              │
│  • Article Title             │  SECTION 4: COVER IMAGE      │
│  • PDF File                  │  • Image upload              │
│  • Format                    │                              │
├──────────────────────────────┼──────────────────────────────┤
│  SECTION 2: DETAILS          │  SECTION 3: CLASSIFICATION   │
│  • Year, Language            │  • Authors (multi-select)    │
│  • ISBN, Edition             │  • Subjects (multi-select)   │
│  • Pages, Copies             │                              │
│  • Publisher, Description    │                              │
└──────────────────────────────┴──────────────────────────────┘

[Cancel]                                [🚀 Create Article]
```

### Mobile View (<768px)
```
┌─────────────────────────────────────┐
│      ⚡ QUICK ARTICLE UPLOAD       │
├─────────────────────────────────────┤
│ SECTION 1: ESSENTIAL                │
│ • Article Title                     │
│ • PDF File                          │
│ • Format                            │
├─────────────────────────────────────┤
│ SECTION 2: DETAILS                  │
│ • Year, Language                    │
│ • ISBN, Edition                     │
│ • Pages, Copies                     │
├─────────────────────────────────────┤
│ SECTION 3: CLASSIFICATION           │
│ • Authors                           │
│ • Subjects                          │
├─────────────────────────────────────┤
│ SECTION 4: COVER IMAGE              │
│ [Image upload]                      │
├─────────────────────────────────────┤
│ [Cancel]  [🚀 Create Article]       │
└─────────────────────────────────────┘
```

---

## 🎨 Color & Design System

### Colors
```
Primary:     #7b0f2b  (Deep Red/Maroon)
Secondary:   #ec4899  (Pink)
Accent:      #e11d48  (Rose)
Gradient:    from-[#7b0f2b] to-rose-600

Success:     #10b981  (Emerald)
Error:       #ef4444  (Red)
Warning:     #f59e0b  (Amber)
Info:        #3b82f6  (Blue)
```

### Interactive Elements
```
Button (Primary):
  Normal:   from-[#7b0f2b] to-rose-600 (gradient)
  Hover:    shadow-lg
  Active:   opacity-90
  Disabled: opacity-50

Button (Secondary):
  Normal:   border border-slate-300
  Hover:    bg-slate-50
  
Input Fields:
  Border:   border-slate-300
  Focus:    ring-2 ring-[#7b0f2b]/30
```

---

## 📋 Form Field Reference

### Required Fields
| Field | Type | Placeholder | Notes |
|-------|------|-------------|-------|
| Title | Text | "Enter article title..." | Must not be empty |
| File | Upload or ID | "Click to upload" | PDF or file ID |
| Format | Checkbox | - | At least one required |

### Optional Fields
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| Year | Text | - | Publication year |
| Language | Select | Auto-detect | From server list |
| ISBN | Text | - | International Standard Book Number |
| Edition | Text | - | Edition information |
| Page Count | Number | - | Number of pages |
| Available Copies | Number | 1 | Stock quantity |
| Publisher | Text | - | Publishing information |
| Summary | Textarea | - | Brief description |
| Authors | Multi-Select | - | Can add new |
| Subjects | Multi-Select | - | Can add new |
| Cover | Image | - | PNG, JPG, WEBP |
| Public | Checkbox | true | Visibility toggle |

---

## 🔄 User Flows

### Minimal Flow (2 minutes)
```
1. Open form
   ↓
2. Enter title
   ↓
3. Upload PDF
   ↓
4. Select format
   ↓
5. Click "Create Article"
   ✅ Done!
```

### Standard Flow (5 minutes)
```
1. Open form
   ↓
2. Enter title
   ↓
3. Upload PDF
   ↓
4. Select format + additional formats
   ↓
5. Add metadata (year, lang, ISBN)
   ↓
6. Add authors and subjects
   ↓
7. Upload cover image
   ↓
8. Review settings
   ↓
9. Click "Create Article"
   ✅ Done!
```

### Complete Flow (10 minutes)
```
1. Open form
   ↓
2. Fill all required fields
   ↓
3. Fill all optional metadata
   ↓
4. Add multiple authors
   ↓
5. Add multiple subjects/categories
   ↓
6. Upload high-quality cover image
   ↓
7. Review all information
   ↓
8. Set visibility (public/private)
   ↓
9. Click "Create Article"
   ✅ Article published!
```

---

## 🚨 Error Handling

### Common Errors & Solutions

```
ERROR: "Title is required"
SOLUTION: Fill the Article Title field

ERROR: "File ID is required"
SOLUTION: Upload a PDF file OR enter an existing file ID

ERROR: "Failed to upload PDF file"
SOLUTION: Check file size (max 50MB), try again

ERROR: "Failed to create article: 400"
SOLUTION: Check all required fields are filled

ERROR: "Forbidden" (403)
SOLUTION: User account doesn't have editor role

ERROR: "Missing bearer token" (401)
SOLUTION: Login first or refresh page
```

### Visual Feedback

✅ **Success States**
- Green border on file upload
- "✓ filename.pdf" shown
- Green "Create Article" button changes to checkmark

⚠️ **Error States**
- Red error box at top of form
- Field highlights with red border
- Error message explains the issue

⏳ **Loading States**
- "Creating..." text in submit button
- Button disabled to prevent double-submit
- Cursor changes to loading animation

---

## 🎯 Tips & Tricks

### For Speed
1. **Use keyboard:** Tab through fields, Enter to submit
2. **Reuse metadata:** Authors/subjects saved locally
3. **Minimal info:** Only fill what's necessary
4. **Drafts:** Browser localStorage auto-saves form state

### For Quality
1. **Add descriptions:** Helps with searchability
2. **Set correct language:** Improves categorization
3. **Use categories:** Makes browsing easier
4. **Upload cover:** Increases visual appeal
5. **Complete metadata:** Better library organization

### For Accessibility
1. **Tab order:** All fields are keyboard accessible
2. **Labels:** Clear labels on all inputs
3. **Help text:** Hover over ? for more info
4. **Errors:** Clear, non-technical error messages
5. **Contrast:** All text meets WCAG 2.1 AA standard

---

## 📱 Mobile Tips

### On Small Screens
- Form stacks vertically for easier scrolling
- Touch targets are larger (44x44px minimum)
- File upload area is easy to tap
- Submit button is prominently placed

### File Upload on Mobile
- Tap the upload area to select from device
- Long press and hold for additional options
- Shows file name and size after selection
- Cancel upload by clearing the file

---

## ⚙️ Technical Requirements

### Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Device Support
- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 1199px)
- ✅ Mobile (320px - 767px)

### Network Requirements
- PDF upload: Up to 50MB
- Cover image: Up to 10MB
- API latency: < 5 seconds recommended

---

## 🔐 Permissions & Access

### Who Can Use This?
```
✅ Editor role
✅ Admin role
✅ Librarian role
❌ Student role (denied)
❌ Guest (requires login)
```

### What Can Be Done?
```
✅ Create articles/books
✅ Upload files
✅ Create authors
✅ Create subjects
✅ Set visibility (public/private)
❌ Modify existing articles (use edit endpoint)
❌ Delete articles
```

---

## 📞 Getting Help

### Check These First
1. **Browser Console:** F12 → Console tab for errors
2. **Network Tab:** F12 → Network to see API calls
3. **Form Validation:** Red boxes show required fields
4. **Error Messages:** At top of form in red box

### Common Issues
```
Q: Form won't submit
A: Check all red-marked fields are filled

Q: File upload fails
A: Check file size (max 50MB), format (PDF only)

Q: "403 Forbidden" error
A: Ask admin to give you Editor role

Q: Form data disappears on refresh
A: Check browser allows localStorage
```

---

## 🎓 Learning Path

### Beginner
1. Read this guide
2. Fill minimal form (title + file)
3. Submit and see result
4. Review created article

### Intermediate
1. Add metadata (year, language, ISBN)
2. Add authors and subjects
3. Upload cover image
4. Verify visibility settings

### Advanced
1. Batch upload multiple articles
2. Use keyboard shortcuts
3. Optimize metadata for search
4. Create template workflows

---

## 📊 Statistics & Monitoring

### Form Performance
- Average fill time: 2-5 minutes
- Average submit time: 3-10 seconds
- File upload time: Depends on file size
- Database commit: < 1 second

### Success Metrics
- Form completion rate: Track submissions
- Error rate: Monitor failed attempts
- User satisfaction: Track success confirmations
- Performance: Monitor API response times

---

## 🔗 Related Pages

- **Admin Dashboard:** `/admin` (entry point)
- **Books Management:** `/admin/books` (existing articles)
- **User Profile:** `/profile` (your settings)
- **Catalog Browse:** `/catalog` (view articles)

---

## 💾 Data Persistence

### What Gets Saved?
✅ All form submissions → Database
✅ Author/Subject lists → Cached locally
✅ Form state → Browser localStorage (auto-save)

### What Gets Lost?
❌ Unsaved form data on hard refresh (Ctrl+R)
✅ But recoverable from local cache

### Clearing Cache
```
Browser Console (F12):
> localStorage.removeItem('articles')
> localStorage.removeItem('local_authors')
> localStorage.removeItem('local_subjects')
```

---

## 🎉 Success!

Once you create an article:
1. ✅ Confirmation message displays
2. 🔄 Automatically redirects to admin
3. 📖 Article appears in book list
4. 🔍 Becomes searchable
5. 👥 Visible to all users (if public)

---

**Quick Reference Card - Print & Keep Handy**

```
┌─────────────────────────────────────────────┐
│     QUICK ARTICLE UPLOAD - CHEAT SHEET      │
├─────────────────────────────────────────────┤
│ REQUIRED:                                    │
│ • Title: Article name                       │
│ • File: PDF upload or ID                    │
│ • Format: At least one (EBOOK, etc)         │
│                                             │
│ OPTIONAL:                                    │
│ • Year, Language, ISBN, Edition             │
│ • Description, Authors, Subjects            │
│ • Cover image, Visibility setting           │
│                                             │
│ QUICK TIPS:                                  │
│ • 2 min for minimal upload                  │
│ • 5 min for complete metadata               │
│ • Authors/subjects auto-created             │
│ • Public by default                         │
│                                             │
│ PATH: /admin/articles/quick                 │
│ BUTTON: ⚡ Quick Article (in admin)         │
│                                             │
│ ERRORS? Check:                              │
│ • All required fields filled                │
│ • File upload successful                    │
│ • User has Editor role                      │
│ • Browser allows localStorage               │
└─────────────────────────────────────────────┘
```

---

**Last Updated:** January 28, 2026  
**Version:** 1.0  
**Status:** Ready for Production
