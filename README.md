# AWS Lambda Deployer - VS Code Extension

Bu VS Code extension'ı, AWS Lambda fonksiyonlarını doğrudan VS Code'dan kolayca deploy etmenizi sağlar.

## 👨‍💻 Developer

**Hüseyin Karacif**  
GitHub: [github.com/huseyinkaracif](https://github.com/huseyinkaracif)

---

## Özellikler

- ✅ Dosyaya sağ tıklayarak "AWS Deploy Et" seçeneği
- 🔐 AWS Credentials yönetimi
- 🚀 Otomatik Lambda fonksiyon oluşturma/güncelleme
- 📝 Çoklu dil desteği (JavaScript, TypeScript, Python, Java)
- 💾 Güvenli credentials saklama
- 🔄 AWS CLI ve SDK desteği (otomatik seçim)
- 📊 Progress göstergesi
- 🎯 Gelişmiş hata yönetimi

## Kurulum

### Gereksinimler

- Visual Studio Code
- Node.js (v14 veya üzeri)
- AWS CLI (opsiyonel)

### Geliştirme Kurulumu

1. Projeyi klonlayın:
```bash
git clone https://github.com/huseyinkaracif/obidev-lambda-deployer.git
cd obidev-lambda-deployer
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. TypeScript'i derleyin:
```bash
npm run compile
```

4. Extension'ı VS Code'da test edin:
```bash
code --extensionDevelopmentPath=.
```

## Kullanım

1. VS Code'da bir Lambda fonksiyonu dosyası açın
2. Dosyaya sağ tıklayın
3. "AWS Deploy Et" seçeneğini seçin
4. İlk kullanımda AWS credentials'ınızı girin
5. Lambda fonksiyon adını belirleyin
6. Deploy işlemini bekleyin

## Desteklenen Dosya Türleri

- `.js` - JavaScript
- `.mjs` - ES Modules JavaScript
- `.ts` - TypeScript  
- `.py` - Python
- `.java` - Java

## Güvenlik

- AWS credentials güvenli şekilde saklanır
- Extension sadece gerekli AWS izinlerini kullanır
- Credentials şifrelenmiş olarak kaydedilir

## Geliştirme

### Proje Yapısı

```
src/
├── extension.ts          # Ana extension dosyası
├── awsCredentials.ts     # AWS credentials yönetimi
└── lambdaDeployer.ts    # Lambda deployment işlemleri
```

### Komutlar

- `npm run compile` - TypeScript'i derle
- `npm run watch` - Geliştirme modunda izle
- `npm run vscode:prepublish` - Yayın öncesi hazırlık

## Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## Destek

Sorunlarınız için GitHub Issues kullanın. 