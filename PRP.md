# AWS Lambda Deployer - VS Code Extension PRP

## Proje Özeti
Visual Studio Code için AWS Lambda fonksiyonlarını kolayca deploy etmeyi sağlayan extension geliştirilecektir.

## Hedef Kullanıcılar
- AWS Lambda fonksiyonları geliştiren geliştiriciler
- VS Code kullanan AWS geliştiricileri

## Temel Özellikler

### 1. Context Menu Entegrasyonu
- Dosyaya sağ tıklandığında "AWS Deploy Et" seçeneği görünecek
- Seçilen dosyanın path'i otomatik olarak alınacak

### 2. AWS Credentials Yönetimi
- AWS credentials kontrolü yapılacak
- Credentials yoksa popup ile kullanıcıdan alınacak
- Credentials güvenli şekilde kaydedilecek

### 3. Lambda Fonksiyon Adı Yönetimi
- İlk deploy için lambda fonksiyon adı kullanıcıdan alınacak
- Popup ile fonksiyon adı sorulacak
- Enter ile onaylanacak

### 4. AWS CLI Entegrasyonu
- AWS CLI üzerinden deploy işlemi gerçekleştirilecek
- Deploy sonucu kullanıcıya bildirilecek
- Başarılı/başarısız durumlar için popup gösterilecek

## Teknik Gereksinimler

### Geliştirme Ortamı
- Node.js
- TypeScript
- VS Code Extension API
- AWS SDK for JavaScript

### Dosya Yapısı
```
obidev-lambda-deployer/
├── src/
│   ├── extension.ts
│   ├── awsCredentials.ts
│   ├── lambdaDeployer.ts
│   └── utils/
├── package.json
├── README.md
└── PRP.md
```

### Ana Fonksiyonlar
1. `checkAWSCredentials()` - AWS credentials kontrolü
2. `getLambdaFunctionName()` - Lambda fonksiyon adı alma
3. `deployLambda()` - AWS CLI ile deploy işlemi
4. `showNotification()` - Kullanıcı bildirimleri

## Kullanım Senaryosu
1. Kullanıcı VS Code'da lambda fonksiyonu dosyasına sağ tıklar
2. "AWS Deploy Et" seçeneğini seçer
3. Extension AWS credentials kontrolü yapar
4. Credentials yoksa popup ile alır ve kaydeder
5. İlk deploy ise lambda fonksiyon adını sorar
6. AWS CLI ile deploy işlemini başlatır
7. Sonucu kullanıcıya bildirir

## Çıktılar
- VS Code Extension (.vsix dosyası)
- Kullanıcı kılavuzu
- Kurulum talimatları 