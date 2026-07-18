# BrailleScan Mesh Translator

**Dispozitiv bazat pe Raspberry Pi care recunoaște și traduce text Braille și text tipărit, utilizând o cameră cu lentilă macro, senzori, o interfață web și un afișaj LCD.**

---

## 📚 **DOCUMENTAȚIE - GHID DE PORNIRE RAPIDĂ**

### 🔴 **CITIȚI MAI ÎNTÂI - Documentele esențiale:**

| 📄 Document | Descriere | Unde |
|------------|-----------|------|
| **COMENZI SETUP** | ⭐ Toate comenzile necesare | [SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt) |
| **Instalare în 5 Pași** | Start rapid | [Vezi mai jos ↓](#-pornire-în-5-pași) |
| **Hardware Necesar** | Componente și cerințe | [Vezi mai jos ↓](#-cerințe-hardware-complete) |
| **Modele 3D** | Fișiere și tipărire | [Vezi mai jos ↓](#-modele-3d-și-construcție) |
| **Rezolvare Probleme** | Soluții comune | [Vezi mai jos ↓](#-ghid-rezolvare-probleme) |
| **Comenzi Utile** | Referință rapidă | [Vezi mai jos ↓](#-comenzi-setup-și-referință) |

---

## 🚀 **Pornire în 5 Pași**

### Ce aveți nevoie:
- ✅ Raspberry Pi 3 A+ (sau mai nou)
- ✅ Card microSD 32GB+
- ✅ Sursă 5V/2A
- ✅ Camera Raspberry Pi 
- ✅ Display LCD
- ✅ Senzori

### Pași:

**1️⃣ Instalare Sistem de Operare**
```bash
# Descărcați Raspberry Pi Imager din:
# https://www.raspberrypi.com/software/
# 
# Selectați: Raspberry Pi OS Bookworm (64-bit)
# Scrieți pe card microSD
```

**2️⃣ Conectare Hardware**
```
Camera      → CSI Flex Cable
Display     → I2C (GPIO 2, 3)
Senzori     → I2C
Alimentare  → 5V/2A USB
```

**3️⃣ Clonare și Setup**
```bash
# Conectare SSH la Pi
ssh pi@raspberrypi.local

# Clonare repository
git clone https://github.com/DoctorBeryl/Braillescan-Mesh-Translator.git
cd Braillescan-Mesh-Translator

# Instalare dependințe (3-5 minute pe Pi 3)
npm install
```

**4️⃣ Pornire Aplicație**
```bash
# Mod dezvoltare (cu reîncărcare automată)
npm run dev

# Mod producție
npm run build
npm run server
```

**5️⃣ Accesare în Browser**
```
http://raspberrypi.local:5173    (mod dezvoltare)
http://raspberrypi.local:3001    (mod producție)
```

### 👉 **PENTRU TOATE COMENZILE DETALIATE, DESCHIDEȚI:** 
# [📄 SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt)

---

## 📋 **CUPRINS COMPLET**

### 🔧 Secțiuni Tehnice
- [Stack Tehnologic](#-stack-tehnologic)
- [Dependințe și Modele](#-dependințe-și-modele)
- [Cerințe Hardware Complete](#-cerințe-hardware-complete)
- [Instalare Detaliată](#-instalare-detaliată)
- [Comenzi Setup și Referință](#-comenzi-setup-și-referință)
- [Modele 3D și Construcție](#-modele-3d-și-construcție)
- [Ghid Rezolvare Probleme](#-ghid-rezolvare-probleme)
- [Performanță și Optimizare](#-performanță-și-optimizare)

### 📖 Secțiuni Proiect
- [Descrierea Problemei](#descrierea-problemei-pe-care-o-rezolvăm)
- [Soluția Propusă](#descrierea-soluției-propuse)
- [Publicul Țintă](#definirea-publicului-țintă)
- [Funcționalități](#prezentarea-funcționalităților-aplicației)
- [Arhitectura Sistemului](#arhitectura-aplicației)
- [Puncte Forte](#elemente-distinctive-ale-aplicației--puncte-forte)
- [Justificare Tehnologii](#justificarea-folosirii-tehnologiilor-alese)
- [Opinia Autorilor](#opinia-autorilor-despre-proiect)
- [Roadmap Viitor](#roadmap)

### 📚 Resurse
- [Întrebări Frecvente](#-întrebări-frecvente)
- [Resurse Externe](#-resurse-externe-și-comunitate)
- [Licență](#-licență)

---

## 🛠️ **Stack Tehnologic**

### Frontend
- **React 19** - Interfață utilizator
- **Vite 8** - Build tool cu dev server rapid
- **Tailwind CSS 4** - Stiluri CSS modern
- **Lucide React** - Pictograme
- **Google Model Viewer** - Vizualizare modele 3D

### Backend
- **Node.js** - Runtime JavaScript
- **Express 5** - Server web
- **Google Translate API** - Traducere text

### Hardware Integration
- **libcamera/rpicam** - Control cameră Raspberry Pi
- **nmcli** - Management rețea Wi-Fi
- **I2C/SPI drivers** - Comunicare senzori

### Development Tools
- **Oxlint** - JavaScript linter
- **Concurrently** - Rulare scripturi simultane

---

## 📦 **Dependințe și Modele**

### Dependințe Runtime
| Pachet | Versiune | Scop |
|--------|----------|------|
| react | ^19.2.7 | Framework UI |
| react-dom | ^19.2.7 | React DOM |
| express | ^5.1.0 | Server HTTP |
| @google/model-viewer | ^4.3.1 | Vizualizare 3D |
| @vitalets/google-translate-api | ^9.2.1 | Traducere |
| lucide-react | ^1.24.0 | Pictograme |

### Dependințe Sistem (pe Raspberry Pi)
- **Raspberry Pi OS Bookworm** (latest)
- **Node.js 18+** pentru backend
- **npm** sau **yarn** pentru package management
- **libcamera** sau **rpicam-apps** pentru cameră
- **NetworkManager (nmcli)** pentru Wi-Fi
- **i2c-tools** pentru senzori I2C

### Link-uri Descărcare
| Tool | Link | Scop |
|------|------|------|
| Raspberry Pi Imager | [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/) | Instalare OS |
| Node.js (ARM) | [https://nodejs.org/](https://nodejs.org/) | Runtime JavaScript |
| Repository GitHub | [https://github.com/DoctorBeryl/Braillescan-Mesh-Translator](https://github.com/DoctorBeryl/Braillescan-Mesh-Translator) | Cod sursă |

---

## 🖥️ **Cerințe Hardware Complete**

### Componente Esențiale
- **Raspberry Pi 3 A+** sau mai nou (Pi 4/5 recomandat)
- **Sursă alimentare**: 5V/2A minimum (3A pentru Pi 4/5)
- **Card microSD**: 32GB+ (Class 10 recomandat)
- **Camera Raspberry Pi Module 3** cu lentilă macro
- **Display LCD**: 16x2 sau 20x4 cu interfață I2C/SPI
- **Senzori distanță**: VL53L0X sau similar
- **Conectivitate**: Wi-Fi încorporat (Pi 3A+ și mai nou)

### Componente Opționale
- Adaptor Wi-Fi extern pentru dual-band
- Răcitori de microprocesor
- Powerbank pentru portabilitate
- Carcasă de protecție

### Specificații de Putere
- Consum curent: 500-800mA la 5V (steady-state)
- Peak current: până la 1.5A (cu cameră)
- Recommended PSU: 5V/2.5A minimum

### Conexiuni GPIO

```
Raspberry Pi GPIO Mapping:
├── I2C (pentru display și senzori)
│   ├── GPIO 2 (SDA)
│   └── GPIO 3 (SCL)
│
├── Camera
│   └── CSI Flex Cable
│
└── Alimentare
    ├── 5V
    └── GND
```

---

## 📥 **Instalare Detaliată**

### Pas 1: Instalare Raspberry Pi OS

1. Descărcați [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Selectați device: Raspberry Pi (versiunea dumneavoastră)
3. Selectați OS: Raspberry Pi OS Bookworm 64-bit
4. Selectați storage: Card microSD
5. Apăsați "Next" și configurați:
   - Hostname: `braillescan`
   - Enable SSH: ✅ 
   - Set password
   - Configure Wi-Fi (opțional)
6. Apăsați "Write" și așteptați

### Pas 2: Conectare Inițială

```bash
# SSH pe Pi după boot (2-3 minute)
ssh pi@braillescan.local

# Sau folosiți IP direct
ssh pi@<IP_ADDRESS>
```

### Pas 3: Update Sistem

```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
```

### Pas 4: Activare Interfețe

```bash
sudo raspi-config
# Navigați: Interfacing Options
# Activați: Camera, I2C, SPI, SSH
# Reboot: sudo reboot
```

### Pas 5: Instalare Dependințe Sistem

```bash
sudo apt install -y \
  git curl build-essential python3-dev \
  libcamera-apps libraspberrypi-bin \
  i2c-tools nodejs npm
```

### Pas 6: Instalare Node.js LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm
```

### Pas 7: Clonare și Instalare Repository

```bash
cd ~
git clone https://github.com/DoctorBeryl/Braillescan-Mesh-Translator.git
cd Braillescan-Mesh-Translator
npm install
```

### Pas 8: Testare

```bash
# Testare cameră
libcamera-hello --list-cameras

# Testare I2C (dacă conectate)
i2cdetect -y 1

# Pornire aplicație
npm run dev
```

### Pas 9: Setup Serviciu Systemd (Opțional)

Pentru auto-start la boot:

```bash
sudo nano /etc/systemd/system/braillescan.service
```

Adăugați:
```ini
[Unit]
Description=BrailleScan Mesh Translator
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Braillescan-Mesh-Translator
ExecStart=/usr/bin/npm run dev
Restart=always

[Install]
WantedBy=multi-user.target
```

Apoi:
```bash
sudo systemctl daemon-reload
sudo systemctl enable braillescan.service
sudo systemctl start braillescan.service
```

---

## ⚙️ **Comenzi Setup și Referință**

### Comenzi Dezvoltare

```bash
# Start server cu hot reload
npm run dev

# Build pentru producție
npm run build

# Preview build
npm run preview

# Run linter
npm run lint

# Start doar server backend
npm run server
```

### Comenzi Cameră

```bash
# Test disponibilitate cameră
libcamera-hello --list-cameras

# Capture imagine
libcamera-jpeg -o test.jpg

# Stream cameră (30 secunde)
rpicam-vid -t 30000 -o test.h264
```

### Comenzi Rețea

```bash
# Listă rețele Wi-Fi disponibile
nmcli dev wifi list

# Conectare la rețea
nmcli dev wifi connect "SSID" password "PASSWORD"

# Status conexiune
nmcli con show
```

### Comenzi Monitoring

```bash
# Temperatură CPU
vcgencmd measure_temp

# Monitor sistem (real-time)
htop

# Utilizare disk
df -h

# Utilizare memorie
free -h
```

### Comenzi Serviciu Systemd

```bash
# Status
sudo systemctl status braillescan.service

# Start/Stop/Restart
sudo systemctl start braillescan.service
sudo systemctl stop braillescan.service
sudo systemctl restart braillescan.service

# Logs (real-time)
sudo journalctl -u braillescan.service -f

# Logs (ultimi 50 linii)
sudo journalctl -u braillescan.service -n 50
```

### 👉 **PENTRU REFERINȚĂ COMPLETĂ A TUTUROR COMENZILOR, DESCHIDEȚI:**
# [📄 SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt)

---

## 🎨 **Modele 3D și Construcție**

### Fișiere Modele

Toate modelele sunt în directorul `3dmodels/`:

| Fișier | Mărime | Scop | Timp Tipărire* |
|--------|--------|------|----------------|
| MainHolder.stl | 1.0 MB | Carcasă principală | 10-12 ore |
| CoverLeft.stl | 328 KB | Capac stânga | 6-8 ore |
| CoverRight.stl | 365 KB | Capac dreapta | 6-8 ore |
| Handle.stl | 252 KB | Mânere transport | 4-5 ore |
| RaspberryPiCameraModule3Cover.stl | 447 KB | Protecție cameră | 3-4 ore |
| DistanceSensorCover.stl | 80 KB | Carcasă senzor | 1-2 ore |
| CoverExtras.stl | 314 KB | Piese suplimentare | 4-5 ore |
| CameraExtras.stl | 11 KB | Ajustări fine cameră | <1 oră |

*Estimări pentru: layer 0.2mm, infill 20%, PLA la 50mm/s

### Setări Tipărire Recomandări

```
Material:          PLA (ușor de tipărit) sau PETG
Layer Height:      0.2mm (0.1mm pentru detalii fine)
Infill:            15-20% (suficient pentru rezistență)
Viteza:            40-60mm/s
Temperatura:       200-210°C (PLA)
Bed Temp:          60°C (PLA)
Suporturi:         Necesare pentru unghiuri >45°
Total Filament:    ~1.5-2kg
```

### Ordine Asamblare

1. Tipărire toate piesele
2. Montare Raspberry Pi pe RaspberryPiFlooring
3. Instalare cameră în cover
4. Montare senzori în DistanceSensorCover
5. Asamblare carcasă principală (MainHolder)
6. Atașare capace (CoverLeft, CoverRight)
7. Instalare mânere (Handle)
8. Piese suplimentare după caz

### Servicii 3D Printing Online

Dacă nu aveți imprimantă:
- **Shapeways**: https://www.shapeways.com/
- **Sculpteo**: https://www.sculpteo.com/
- Servicii locale în orașele mari

---

## 🔧 **Ghid Rezolvare Probleme**

### Camera Nu Este Detectată

```bash
# Verificare disponibilitate
libcamera-hello --list-cameras

# Dacă nu funcționează:
sudo raspi-config
# Interfacing Options → Camera → Enable
```

### Probleme Conexiune Wi-Fi

```bash
# Restart network manager
sudo systemctl restart NetworkManager

# Reconectare la rețea
nmcli con delete "SSID"
nmcli dev wifi connect "SSID" password "PASSWORD"
```

### Aplicația Nu Pornește

```bash
# Verificare porturi în uz
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :5173

# Kill process pe port (exemplu: 3001)
sudo kill -9 $(lsof -t -i:3001)

# Verificare Node.js
node --version
npm --version
```

### Probleme de Performanță

```bash
# Temperatură CPU (trebuie <80°C)
vcgencmd measure_temp

# Monitor real-time
htop

# Verificare throttling
vcgencmd get_throttled
# Valoare ne-zero = throttling activ
```

### Senzori I2C Nu Se Detectează

```bash
# Scan I2C
i2cdetect -y 1

# Test adresă specifică (ex: 0x29 pentru VL53L0X)
i2cget -y 1 0x29

# Dacă nu găsește: verificare conexiuni și putere
```

---

## ❓ **Întrebări Frecvente**

**P: Pot folosi altă cameră?**
R: Codul este optimizat pentru Raspberry Pi Camera Module 3. Alte camere (USB, etc.) necesită modificări la codul de streaming.

**P: Care sunt specificele minime de Raspberry Pi?**
R: Pi 3 A+ minim. Pi 4 sau 5 recomandat pentru performanță mai bună.

**P: Funcționează offline?**
R: Da, totul în afară de traducere (care necesită internet). Toate funcțiile locale funcționează fără conexiune.

**P: Cum actualizez aplicația?**
R: 
```bash
cd ~/Braillescan-Mesh-Translator
git pull origin main
npm install
sudo systemctl restart braillescan.service
```

**P: Pot accesa de la exterior?**
R: Da, dacă configurați interfața Wi-Fi secundară pentru internet. Aplicația va fi accessible via acea rețea.

**P: Care este autonomia bateriei?**
R: Depinde de capacitate. Un powerbank 20,000mAh = ~8-10 ore funcționare continuă.

**P: Pot modifica modelele 3D?**
R: Da! Importați STL-urile în Blender, Fusion 360, etc. și modificați după nevoie.

---

## 📊 **Performanță și Optimizare**

### Metric Așteptate (Raspberry Pi 3 A+)
- FPS cameră: ~15 (configurable)
- Timp traducere: 1-3 secunde
- Utilizare memorie: ~150-200MB
- Utilizare CPU: 20-40% (single core)
- Spațiu disk necesar: ~5GB (OS + app)

### Pe Raspberry Pi 4
- FPS cameră: ~30 posibil
- Timp traducere: <2 secunde
- Utilizare CPU: 10-20%
- Performance mult mai bună

---

## 📁 **Structură Proiect**

```
Braillescan-Mesh-Translator/
├── src/                      # Frontend React
│   ├── App.jsx              # Componenta principală
│   ├── components/          # Componente reutilizabile
│   └── assets/              # Imagini și resurse
├── server/                  # Backend Node.js
│   └── index.js            # Server Express
├── public/                  # Fișiere statice
├── 3dmodels/               # Modele STL
├── dist/                   # Build producție
├── package.json            # Dependințe
├── vite.config.js          # Configurare Vite
├── README.md               # Acest fișier
└── SETUP_COMMANDS.txt      # Referință comenzi
```

---

# BrailleScan Mesh Translator -- Documentație Proiect

## Descrierea Problemei pe care o Rezolvăm

Accesul persoanelor cu deficiențe de vedere la informațiile scrise
reprezintă încă o provocare majoră. Deși sistemul Braille este
standardul internațional pentru citirea tactilă, un număr redus de
persoane din populația generală cunosc acest sistem de scriere. În
consecință, membrii familiei, profesorii, voluntarii sau alte persoane
care interacționează cu utilizatorii nevăzători întâmpină dificultăți în
interpretarea documentelor redactate în Braille.

Pe de altă parte, dispozitivele realizate în cadrul unor programe
universitare sau a unor producători comerciali, dedicate traducerii
Braille în text obișnuit, nu sunt accesibile publicului, iar costurile
acestora se ridică la sute sau chiar mii de dolari. Acestea utilizează
componente specializate și oferă o flexibilitate redusă în ceea privește
costurile. De asemenea, majoritatea soluțiilor existente sunt orientate
exclusiv către conversia textului tipărit în Braille sau necesită
echipamente profesionale pentru scanare.

BrailleScan Mesh Translator își propune să elimine aceste limitări prin
dezvoltarea unui dispozitiv accesibil, portabil și ușor de utilizat,
capabil să traducă atât textul Braille embosat, cât și textul tipărit
obișnuit, utilizând tehnologii moderne de procesare a imaginilor și
senzori dedicați.

## Descrierea Soluției Propuse

BrailleScan Mesh Translator este un aparat electronic inteligent
construit în jurul unui microcalculator Raspberry Pi. Dispozitivul
utilizează o cameră echipată cu lentilă macro pentru captarea în detaliu
a suprafeței hârtiei embosate și senzori care permit analizarea
reliefului caracterelor Braille.

Imaginea captată este procesată, fiind identificată poziția punctelor
Braille și reconstruit caracterul corespunzător. Rezultatul este apoi
tradus automat în alfabetul latin și afișat atât pe interfața web.
Totodată, aparatul oferă indicații în timp real despre poziția optima a
camerei pe un ecran LCD integrat.

În plus, dispozitivul poate funcționa și ca un scanner OCR pentru text
obișnuit, utilizând aceeași cameră și algoritmi de recunoaștere optică a
caracterelor.

Întregul sistem este accesibil prin intermediul unei aplicații web
găzduite chiar pe Raspberry Pi, fără a necesita instalarea unui software
suplimentar pe calculatorul utilizatorului. De asemenea, aparatul este
portabil, fiind încadrat într-un cadru printat 3D, ceea ce îi permite
utilizarea în contexte diverse. Acesta nu depinde permanent de o sursă
fixă de curent.

## Definirea Publicului Țintă

Proiectul este destinat în principal:

- persoanelor cu deficiențe de vedere
- profesorilor care predau alfabetul Braille
- instituțiilor de învățământ special
- bibliotecilor pentru nevăzători
- membrilor familiei persoanelor nevăzătoare
- voluntarilor și organizațiilor care lucrează în domeniul incluziunii sociale

De asemenea, dispozitivul poate fi utilizat în scop educațional pentru
familiarizarea persoanelor fără deficiențe de vedere cu sistemul Braille.

## Prezentarea Funcționalităților Aplicației

Principalele funcționalități ale sistemului sunt:

- recunoașterea caracterelor Braille utilizând camera macro și senzorii dedicați
- traducerea automată a textului Braille în alfabetul latin
- recunoașterea textului tipărit prin tehnologia OCR
- afișarea indicațiilor în timp real pe display-ul LCD
- reconstruirea unei reprezentări 3D a textului Braille de pe hârtia scanată
- accesarea unei interfețe web moderne prin intermediul browserului
- funcționarea independentă într-o rețea Wi-Fi creată de Raspberry Pi
- posibilitatea conectării la Internet printr-o a doua interfață wireless, fără întreruperea funcționării rețelei locale
- administrarea și configurarea dispozitivului din interfața web

## Arhitectura Aplicației

Sistemul este alcătuit din două componente principale.

### Dispozitivul Raspberry Pi

Acesta reprezintă nucleul întregii aplicații și are rolul de:

- rulare a sistemului de operare Linux
- control al camerei și al senzorilor
- capturare, stocare și distribuire a imaginilor pentru procesare
- găzduire a aplicației web
- streamingul camerei live pe interfața web
- administrare a rețelei locale
- afișare a instrucțiunilor ajutatoare pe ecranul LCD

Raspberry Pi creează o rețea Wi-Fi proprie (Access Point) pe una din
interfețele de rețea, la care utilizatorii se pot conecta direct.
Opțional, acesta utilizează o a doua interfață Wi-Fi configurată în
modul Station pentru conectarea la Internet, care poate fi totodată
configurată în interfața web, permițând accesul la dispozitiv oricărui
client al acelei rețele.

Întregul ansamblu hardware este montat într-un cadru printat 3D modular,
conceput pentru a oferi stabilitate, protecție componentelor, o formă
compactă și schimbare ușoară a componentelor. Dispozitivul necesită o
sursă de alimentare care poate furniza consistent 5V la 2A prin
intermediul unui cablu Micro-USB. Utilizarea unui acumulator portabil
permite folosirea sa în mod mobil, fără a fi necesară conectarea
permanentă la priză.

### Dispozitivul Host

Poate fi orice calculator, tabletă sau telefon mobil dotat cu un browser
web modern.

Host-ul comunică exclusiv prin protocol HTTP în rețeaua locală și
permite:

- vizualizarea rezultatelor
- configurarea dispozitivului
- monitorizarea procesului de scanare
- accesarea funcțiilor disponibile

## Elemente Distinctive ale Aplicației / Puncte Forte

BrailleScan Mesh Translator se diferențiază de soluțiile existente prin:

- captură de imagini în mod macro pentru analizarea reliefului Braille
- combinarea informațiilor provenite din senzori și procesarea imaginilor pentru creșterea preciziei
- suport simultan pentru traducerea Braille și OCR
- traducerea directă în sau din diferite limbi străine
- funcționalitate offline
- interfață web multiplatformă, fără aplicații dedicate
- cost redus comparativ cu echipamentele comerciale
- arhitectură modulară, care permite extinderea ulterioară

## Justificarea Folosirii Tehnologiilor Alese

Platforma Raspberry Pi 3 A+ a fost aleasă deoarece oferă un raport
foarte bun între performanță, consum energetic și cost. Aceasta dispune
de suficientă putere de procesare pentru analizarea imaginilor în timp
real și permite integrarea facilă cu camere, senzori și dispozitive
periferice. Sistemul de operare Linux oferă stabilitate, suport extins
pentru biblioteci open-source și posibilitatea dezvoltării rapide a
aplicației.

Interfața web a fost preferată în locul unei aplicații desktop deoarece
este independentă de sistemul de operare și poate fi accesată de pe
orice dispozitiv cu browser. Camera prevăzută cu lentilă macro permite
captarea fidelă a reliefului Braille, iar tehnologiile OCR completează
funcționalitatea sistemului prin recunoașterea textului tipărit.
Alegerea acestor tehnologii conduce la un sistem flexibil, ușor de
întreținut și extensibil.

## Opinia Autorilor despre Proiect

Considerăm că beneficiile tehnologiei trebuie să fie disponibile unui
număr cât mai mare de persoane, din acest motiv asistența persoanelor
cu dizabilități reprezintă un scop important al acesteia. Noi am realizat
o soluție bazată pe componente relativ accesibile.

În ceea ce privește utilitatea, un exemplu concret îl reprezintă situația
unui profesor care primește o lucrare redactată în Braille. În loc să
apeleze la un specialist sau să introducă manual informațiile, acesta poate
utiliza BrailleScan Mesh Translator pentru a obține rapid traducerea în
alfabetul latin și pentru a verifica conținutul documentului. În același
mod, membrii familiei pot înțelege mai ușor mesajele scrise în Braille,
facilitând comunicarea zilnică.

## Roadmap

Pentru etapele ulterioare ale dezvoltării propunem:

- creșterea vitezei de recunoaștere
- integrarea unui actuator/display Braille reîmprospătabil pentru conversia inversă
- integrarea unui sintetizator vocal
- dezvoltarea unei aplicații mobile dedicate
- sincronizarea cu servicii cloud
- îmbunătățirea autonomiei și optimizarea designului cadrului printat 3D pentru o portabilitate mai bună
- integrarea sistemelor de inteligență artificială pentru optimizarea recunoașterii, corectarea eventualelor erori și rezumarea conținutului scanat
- implementarea unui sistem autofocus (focalizare automată) pentru cameră

---

## 📚 **Resurse Externe și Comunitate**

### Documentație Oficială
- [Documentația Raspberry Pi](https://www.raspberrypi.com/documentation/)
- [libcamera Documentation](https://libcamera.org/docs.html)
- [Documentația React](https://react.dev/)
- [Ghid Express.js](https://expressjs.com/)

### Comunitate și Suport
- [Forum Raspberry Pi](https://forums.raspberrypi.com/)
- [Stack Overflow](https://stackoverflow.com/) - tag: raspberry-pi, react, node.js
- [GitHub Issues](https://github.com/DoctorBeryl/Braillescan-Mesh-Translator/issues) - Raportare bug-uri și sugestii

### Proiecte Conexe
- [OpenCV pe Raspberry Pi](https://github.com/opencv/opencv)
- [TensorFlow Lite pentru Raspberry Pi](https://www.tensorflow.org/lite)
- [Home Assistant](https://www.home-assistant.io/) - Integrare IoT

---

## 🤝 **Contribuții**

Contribuțiile sunt binevenite! Puteți:

1. Fork repository-ul
2. Creați branch pentru feature (`git checkout -b feature/MinistraFeature`)
3. Commit-ați schimbări (`git commit -m 'Add MinistraFeature'`)
4. Push-ați la branch (`git push origin feature/MinistraFeature`)
5. Deschideți Pull Request

---

## 📄 **Licență**

Acest proiect este licențiat sub MIT License - vezi fișierul [LICENSE](LICENSE) pentru detalii.

---

## 📞 **Contact și Suport**

- **Repository GitHub**: [https://github.com/DoctorBeryl/Braillescan-Mesh-Translator](https://github.com/DoctorBeryl/Braillescan-Mesh-Translator)
- **Mentenanță**: [@DoctorBeryl](https://github.com/DoctorBeryl)
- **Ultimă actualizare**: Iulie 2026

---

**Mulțumim că utilizați BrailleScan Mesh Translator! 🎉**
