// Địa chỉ máy chủ Apps Script (Web app URL), có dạng:
// https://script.google.com/macros/s/AKfycb.../exec
// Dán địa chỉ của bạn vào giữa hai dấu nháy bên dưới.
window.API_URL = 'https://script.google.com/macros/s/AKfycbyZqlO04ZxdH1T4AQ6eLOhw2_msuB7RpyZvxfHHGv0vC7Hrp0tY6dwnVukdch0plfN6/exec';

// Cấu hình Firebase cho chức năng "Đấu cả lớp" (xem hướng dẫn trong apps-script/FIREBASE.md).
// Dán object cấu hình web app Firebase { apiKey, authDomain, databaseURL, projectId, appId, ... }
// vào object bên dưới. Các giá trị này công khai (không phải mật khẩu); dữ liệu được bảo vệ bằng luật firebase/database.rules.json.
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAn1fJ6AkyXnk8jSjVYRZ2ZxoOWSYXHCjE',
  authDomain: 'toan-thay-minh.firebaseapp.com',
  databaseURL: 'https://toan-thay-minh-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'toan-thay-minh',
  appId: '1:579054401271:web:ddda2efd8bbc51f87885f2'
};
