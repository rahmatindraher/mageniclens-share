export default async function handler(req, res) {
  // Izinkan CORS & metode POST/GET
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: 'GOOGLE_DRIVE_API_KEY belum diatur di Environment Variables Vercel.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = body.action;
    const args = Array.isArray(body.args) ? body.args : [];

    // 1. AMBIL DAFTAR FOTO DARI FOLDER GOOGLE DRIVE
    if (action === 'getDrivePhotos') {
      const folderId = String(args[0] || '').trim();
      if (!folderId) {
        return res.status(400).json({ success: false, message: 'ID folder tidak valid.' });
      }

      // Ambil metadata nama folder
      const folderUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(apiKey)}`;
      const folderResp = await fetch(folderUrl);
      const folderData = await folderResp.json();

      if (!folderResp.ok || folderData.error) {
        return res.status(400).json({
          success: false,
          message: 'Folder tidak ditemukan atau belum diatur ke publik ("Siapa saja yang memiliki link").'
        });
      }

      // Ambil seluruh file gambar di dalam folder (mendukung pagination hingga 1000 foto)
      let allFiles = [];
      let pageToken = '';
      do {
        const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
        const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(apiKey)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const listResp = await fetch(listUrl);
        const listData = await listResp.json();

        if (!listResp.ok || listData.error) {
          return res.status(400).json({
            success: false,
            message: (listData.error && listData.error.message) || 'Gagal membaca isi folder Google Drive.'
          });
        }

        if (Array.isArray(listData.files)) {
          allFiles = allFiles.concat(listData.files);
        }
        pageToken = listData.nextPageToken || '';
      } while (pageToken);

      const photos = allFiles.map((f) => ({
        id: f.id,
        name: f.name,
        thumb: `https://lh3.googleusercontent.com/d/${f.id}=s700`,
        full: `https://lh3.googleusercontent.com/d/${f.id}=s2000`
      }));

      return res.status(200).json({
        success: true,
        folderId: folderData.id,
        folderName: folderData.name || 'Galeri Klien',
        photos
      });
    }

    // 2. AMBIL FILE FOTO (BASE64) UNTUK UNDUH SATUAN / WATERMARK / ZIP
    if (action === 'getPhotoFileData') {
      const fileId = String(args[0] || '').trim();
      if (!fileId) {
        return res.status(400).json({ success: false, message: 'ID file tidak valid.' });
      }

      const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
      const metaResp = await fetch(metaUrl);
      const metaData = await metaResp.json();

      if (!metaResp.ok || metaData.error) {
        return res.status(404).json({ success: false, message: 'File tidak dapat diakses.' });
      }

      const mediaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`;
      const mediaResp = await fetch(mediaUrl);

      if (!mediaResp.ok) {
        return res.status(400).json({ success: false, message: 'Gagal mengunduh konten foto.' });
      }

      const arrayBuffer = await mediaResp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = metaData.mimeType || 'image/jpeg';

      return res.status(200).json({
        success: true,
        name: metaData.name || 'photo.jpg',
        mimeType,
        base64,
        dataUrl: `data:${mimeType};base64,${base64}`
      });
    }

    return res.status(400).json({ success: false, message: 'Aksi tidak dikenal.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Server Error: ' + (err.message || String(err))
    });
  }
}
