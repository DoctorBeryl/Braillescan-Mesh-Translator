# BrailleScan Mesh Translator

**A Raspberry Pi-based device that recognizes and translates Braille text and printed text using a macro lens camera, sensors, a web interface, and an LCD display.**

BrailleScan Mesh Translator este un dispozitiv bazat pe Raspberry Pi care recunoaște și traduce text Braille și text tipărit, utilizând o cameră cu lentilă macro, senzori, o interfață web și un afișaj LCD.

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Project Description](#project-description)
- [Solution Overview](#solution-overview)
- [Target Audience](#target-audience)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Technology Stack](#-technology-stack)
- [Dependencies & Models](#-dependencies--models)
- [Hardware Requirements](#-hardware-requirements)
- [Installation & Setup](#-installation--setup)
- [Setup Commands](#-setup-commands)
- [3D Models](#-3d-models)
- [Unique Features](#unique-features)
- [Future Roadmap](#future-roadmap)
- [Author Opinion](#author-opinion)
- [License](#license)

---

## 🚀 Quick Start

For a quick setup guide with all commands, see [SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt)

### Prerequisites
- Raspberry Pi 3 A+ or newer
- microSD card (32GB+ recommended)
- 5V/2A power supply (USB-C or Micro-USB)
- Raspberry Pi Camera Module 3
- Wi-Fi adapter (optional, for internet connectivity)
- LCD display with I2C/SPI interface
- Distance sensors
- 3D printer or 3D printing service for housing

### Quick Setup (5 steps)
1. Flash Raspberry Pi OS to microSD card
2. Connect camera, sensors, and display
3. Clone this repository on Pi
4. Install dependencies: `npm install`
5. Start the application: `npm run dev`

---

---

## 🛠️ Technology Stack

### Frontend
- **React 19** - UI framework
- **Vite 8** - Build tool & development server
- **Tailwind CSS 4** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Google Model Viewer** - 3D model visualization

### Backend
- **Node.js** - Runtime environment
- **Express 5** - Web framework
- **Google Translate API** - Translation service

### Hardware Integration
- **libcamera/rpicam** - Camera control (Raspberry Pi)
- **nmcli** - Network management
- **I2C/SPI drivers** - Sensor communication

### Development Tools
- **Oxlint** - JavaScript linter
- **Concurrently** - Run multiple scripts simultaneously

---

## 📦 Dependencies & Models

### Runtime Dependencies
All dependencies are listed in `package.json` and installed via npm:

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.7 | UI framework |
| react-dom | ^19.2.7 | React DOM rendering |
| express | ^5.1.0 | HTTP server |
| @google/model-viewer | ^4.3.1 | 3D model visualization |
| @vitalets/google-translate-api | ^9.2.1 | Translation service |
| lucide-react | ^1.24.0 | Icons |

### Development Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^8.1.1 | Build tool |
| @vitejs/plugin-react | ^6.0.3 | React plugin for Vite |
| tailwindcss | ^4.3.3 | CSS framework |
| @tailwindcss/vite | ^4.3.3 | Tailwind integration |
| oxlint | ^1.71.0 | Linter |
| concurrently | ^10.0.3 | Run multiple scripts |

### System Dependencies (on Raspberry Pi)
- **Raspberry Pi OS Bookworm** or newer
- **libcamera** or **rpicam-apps** (for camera control)
- **NetworkManager (nmcli)** (for Wi-Fi management)
- **Node.js 18+** (for backend)
- **npm or yarn** (package manager)

### Optional AI/ML Models
While this version uses API-based recognition:
- **TensorFlow.js** - For local OCR (optional future enhancement)
- **PaddleOCR** - Alternative OCR model
- **CRAFT** - Text detection model

### Camera Requirements
- **Raspberry Pi Camera Module 3** (12MP recommended)
- **Macro lens** (10-50mm working distance)
- CSI cable for Pi connection

### Download Links for Key Tools

| Tool | Link | Purpose |
|------|------|---------|
| Raspberry Pi Imager | [https://www.raspberrypi.com/software/](https://www.raspberrypi.com/software/) | Flash OS to SD card |
| Node.js (ARM) | [https://nodejs.org/en/download/package-manager/](https://nodejs.org/en/download/package-manager/) | JavaScript runtime |
| Raspberry Pi Camera Driver | Built-in | Camera support |
| libcamera | [https://libcamera.org/](https://libcamera.org/) | Camera abstraction layer |

---

## 🖥️ Hardware Requirements

### Essential Components
- **Raspberry Pi 3 A+** or newer (Raspberry Pi 4/5 recommended for better performance)
- **Power Supply**: 5V/2A minimum (3A recommended for Pi 4/5)
- **microSD Card**: 32GB+ (Class 10 or UHS recommended)
- **Camera Module**: Raspberry Pi Camera Module 3 with macro lens
- **Display**: 16x2 or 20x4 I2C/SPI LCD display
- **Distance Sensors**: VL53L0X or similar time-of-flight sensor
- **Connectivity**: Built-in Wi-Fi (Pi 3A+ and newer)

### Optional Components
- **External Wi-Fi Adapter**: For dual-band support or range extension
- **Cooling**: Small heatsinks or active cooling for sustained operation
- **UPS/Power Bank**: For portable operation
- **Protective Case**: 3D printed or commercial enclosure

### 3D Printing Parts
All 3D models are located in the `3dmodels/` directory:
- **MainHolder.stl** - Main device housing (1MB - longest print ~8-12 hours)
- **CoverLeft.stl** - Left cover panel
- **CoverRight.stl** - Right cover panel
- **CoverExtras.stl** - Additional cover parts
- **Handle.stl** - Carrying handle
- **RaspberryPiCameraModule3Cover.stl** - Camera protection
- **RaspberryPiFlooring.stl** - Internal mounting plate
- **DistanceSensorCover.stl** - Sensor housing
- **CameraExtras.stl** - Camera mount adjustments

**Print Settings**:
- Material: PLA or PETG
- Layer Height: 0.2mm (0.1mm for finer details)
- Infill: 15-20%
- Supports: Required for most parts
- Print Time: Varies (4-12 hours per part)
- Approximate Filament: ~1.5-2kg total

---

## 📥 Installation & Setup

### Prerequisites Checklist
- [ ] Raspberry Pi with Raspberry Pi OS Bookworm or newer
- [ ] Camera module connected and enabled
- [ ] Display and sensors wired and configured
- [ ] 5V power supply delivering 2A+ stable power
- [ ] Internet connection for initial setup (optional for local operation)
- [ ] Git installed on Raspberry Pi

### Step-by-Step Installation

#### 1. Prepare Raspberry Pi OS


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

# Descrierea soluției propuse

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

# Definirea publicului țintă

Proiectul este destinat în principal:

persoanelor cu deficiențe de vedere;

profesorilor care predau alfabetul Braille;

instituțiilor de învățământ special;

bibliotecilor pentru nevăzători;

membrilor familiei persoanelor nevăzătoare;

voluntarilor și organizațiilor care lucrează în domeniul incluziunii
sociale.

De asemenea, dispozitivul poate fi utilizat în scop educațional pentru
familiarizarea persoanelor fără deficiențe de vedere cu sistemul
Braille.

# Prezentarea funcționalităților aplicației

Principalele funcționalități ale sistemului sunt:

recunoașterea caracterelor Braille utilizând camera macro și senzorii
dedicați

traducerea automată a textului Braille în alfabetul latin

recunoașterea textului tipărit prin tehnologia OCR

afișarea indicațiilor în timp real pe display-ul LCD

reconstruirea unei reprezentari 3D a textului Braille de pe hartia
scanata

accesarea unei interfețe web moderne prin intermediul browserului

funcționarea independentă într-o rețea Wi-Fi creată de Raspberry Pi

posibilitatea conectării la Internet printr-o a doua interfață wireless,
fără întreruperea funcționării rețelei locale

administrarea și configurarea dispozitivului din interfața web

# Arhitectura aplicației

Sistemul este alcătuit din două componente principale.

Dispozitivul Raspberry Pi

Acesta reprezintă nucleul întregii aplicații și are rolul de:

rulare a sistemului de operare Linux

control al camerei și al senzorilor

capturare, stocare si distribuire a imaginilor pentru procesare

găzduire a aplicației web

streamingul camerei live pe interfata web

administrare a rețelei locale

afișare a instrucțiunilor ajutatoare pe ecranul LCD

Raspberry Pi creează o rețea Wi-Fi proprie (Access Point) pe una din
interfețele de retea, la care utilizatorii se pot conecta direct.
Opțional, acesta utilizează o a doua interfață Wi-Fi configurată în
modul Station pentru conectarea la Internet, care poate fi totodată
configurata in interfața web, permitand accesul la dispozitiv oricarui
client al acelei retele.

Întregul ansamblu hardware este montat într-un cadru printat 3D modular
, conceput pentru a oferi stabilitate, protecție componentelor, o formă
compactă si schimbare usoara a componentelor. Dispozitivul necesita o
sursa de alimentare care poate furniza consistent 5V la 2A prin
intermediul unui cablu Micro-USB. Utilizarea unui acumulator portabil
permite folosirea sa în mod mobil, fără a fi necesară conectarea 
permanentă la priză.

Dispozitivul Host

Poate fi orice calculator, tabletă sau telefon mobil dotat cu un browser
web modern.

Host-ul comunică exclusiv prin protocol HTTP în rețeaua locală și
permite:

vizualizarea rezultatelor;

configurarea dispozitivului;

monitorizarea procesului de scanare;

accesarea funcțiilor disponibile.

# Elemente distinctive ale aplicației / Puncte forte

BrailleScan Mesh Translator se diferențiază de soluțiile existente prin:

captură de imagini în mod macro pentru analizarea reliefului Braille

combinarea informațiilor provenite din senzori și procesarea imaginilor
pentru creșterea preciziei

suport simultan pentru traducerea Braille și OCR

traducerea directă în sau din diferite limbi străine

funcționalitate offline

interfață web multiplatformă, fără aplicații dedicate

cost redus comparativ cu echipamentele comerciale sau cu cel a unor 
proiecte de cercetare

arhitectură modulară, care permite extinderea ulterioară a
funcționalităților și modificarea facilă a dispozitivului de catre
utilizatorii experimentați

# Ghid de instalare și configurare

```bash
# Flash Raspberry Pi OS using Raspberry Pi Imager
# Select Raspberry Pi OS Bookworm (latest)
# Advanced options: Enable SSH, Set hostname, Configure Wi-Fi
```

#### 2. Connect Hardware Components
```
Raspberry Pi Connections:
├── Camera Module → CSI/Flex Cable
├── Distance Sensor → I2C (GPIO 2, 3)
├── LCD Display → I2C/SPI (GPIO depending on interface)
├── Power Supply → USB-C/Micro-USB (5V/2A+)
└── Optional: External Wi-Fi → USB port
```

#### 3. Enable Required Interfaces
```bash
# SSH into Raspberry Pi
ssh pi@raspberrypi.local

# Run raspi-config
sudo raspi-config
# Navigate to: Interfacing Options
# Enable: Camera, I2C, SPI, SSH
```

#### 4. Install System Dependencies
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required tools
sudo apt install -y git curl build-essential python3-dev python3-pip
sudo apt install -y libcamera-apps libraspberrypi-bin

# Install Node.js (latest LTS for ARM)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm
```

#### 5. Clone Repository
```bash
git clone https://github.com/DoctorBeryl/Braillescan-Mesh-Translator.git
cd Braillescan-Mesh-Translator
```

#### 6. Install Node.js Dependencies
```bash
npm install
```

#### 7. Configure Wi-Fi Access Point (Optional)
```bash
sudo apt install -y hostapd dnsmasq

# Configure hostapd for AP mode
sudo nano /etc/hostapd/hostapd.conf
# Add configuration for your network

# Enable at boot
sudo systemctl enable hostapd
sudo systemctl start hostapd
```

#### 8. Create systemd Service
```bash
sudo nano /etc/systemd/system/braillescan.service
```

Add the following content:
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
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable braillescan.service
sudo systemctl start braillescan.service
```

#### 9. Verify Installation
```bash
# Check if service is running
systemctl status braillescan.service

# Check camera
libcamera-hello --list-cameras

# Access web interface
# Open browser and navigate to: http://raspberrypi.local:3000
```

---

## ⚙️ Setup Commands

For a complete reference of all setup and development commands, see **[SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt)**

### Development Commands
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Start backend server only
npm run server
```

### Camera & Sensor Commands
```bash
# Test camera availability
libcamera-hello --list-cameras

# Capture test image
libcamera-jpeg -o test.jpg

# Stream camera feed
rpicam-vid -t 30000 -o test.h264

# Test I2C devices
i2cdetect -y 1

# Check system temperature
vcgencmd measure_temp
```

### Network Management
```bash
# List available Wi-Fi networks
nmcli dev wifi list

# Connect to network
nmcli dev wifi connect "SSID" password "PASSWORD"

# Check connection status
nmcli con show

# Create hotspot/AP
nmcli dev wifi hotspot ifname wlan0 ssid "BrailleScan" password "password123"
```

### System Monitoring
```bash
# Check CPU temperature and throttling
watch -n 1 vcgencmd measure_temp

# Monitor system stats
htop

# Check disk usage
df -h

# View application logs
journalctl -u braillescan.service -f
```

---

## 🎨 3D Models

All 3D models for the device housing are provided in STL format in the `3dmodels/` directory.

### Model Files & Specifications

| File | Size | Purpose | Print Time* |
|------|------|---------|------------|
| MainHolder.stl | 1.0 MB | Main device chassis | 10-12 hours |
| CoverLeft.stl | 328 KB | Left protective cover | 6-8 hours |
| CoverRight.stl | 365 KB | Right protective cover | 6-8 hours |
| Handle.stl | 252 KB | Carrying handle | 4-5 hours |
| RaspberryPiCameraModule3Cover.stl | 447 KB | Camera protection | 3-4 hours |
| RaspberryPiFlooring.stl | 9 KB | Internal mounting plate | 1-2 hours |
| CoverExtras.stl | 314 KB | Additional mounting pieces | 4-5 hours |
| DistanceSensorCover.stl | 80 KB | Sensor housing | 1-2 hours |
| CameraExtras.stl | 11 KB | Camera fine adjustments | <1 hour |

**Print Time Estimates based on: 0.2mm layer height, 20% infill, PLA material at 50mm/s speed*

### Printing Recommendations

**Material**: PLA or PETG (PLA is easier to print)
**Layer Height**: 0.2mm (0.1mm for detailed parts)
**Infill**: 15-20% (adequate for structural parts)
**Nozzle Temperature**: 200-210°C (PLA)
**Bed Temperature**: 60°C (PLA)
**Print Speed**: 40-60mm/s
**Supports**: Required for overhangs >45°
**Orientation**: Parts should be oriented for minimal support material

### Post-Processing
1. Remove supports carefully with pliers/knife
2. Sand smooth with 120-400 grit sandpaper
3. Clean thoroughly with IPA or water
4. Optionally prime and paint for durability
5. Assemble components carefully

### Assembly Order
1. Print all parts (total filament ~1.5-2kg)
2. Mount Raspberry Pi on RaspberryPiFlooring
3. Install camera in RaspberryPiCameraModule3Cover
4. Place sensors in DistanceSensorCover
5. Assemble main housing (MainHolder)
6. Attach covers (CoverLeft, CoverRight)
7. Install handle (Handle)
8. Attach extras as needed (CoverExtras, CameraExtras)

### 3D Model Sources & Alternatives
- **Thingiverse**: Browse similar Raspberry Pi projects for inspiration
- **Printables**: Community-driven 3D printing platform
- **MyMiniFactory**: High-quality printable models
- **Local 3D Printing Services**: If you don't have a printer:
  - Shapeways (https://www.shapeways.com/)
  - Sculpteo (https://www.sculpteo.com/)
  - Jito Labs (Local services in various countries)

---

# BrailleScan Mesh Translator -- Documentație

## Descrierea problemei pe care încercăm să o rezolvăm

# Justificarea folosirii tehnologiilor alese

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

---

## 🔧 Troubleshooting

### Camera Not Detected
```bash
# Check if camera is properly connected
libcamera-hello --list-cameras

# If no cameras found:
# 1. Power off Pi
# 2. Reseat camera flex cable
# 3. Power on and try again

# Enable camera in raspi-config if not already done
sudo raspi-config
# Interfacing Options → Camera → Enable
```

### Wi-Fi Connection Issues
```bash
# Restart network manager
sudo systemctl restart NetworkManager

# Forget and reconnect to network
nmcli con delete "SSID"
nmcli dev wifi connect "SSID" password "PASSWORD"

# Check signal strength
nmcli -f IN-USE,SIGNAL,SSID dev wifi list
```

### Application Won't Start
```bash
# Check logs
journalctl -u braillescan.service -n 50

# Manual start to see errors
cd ~/Braillescan-Mesh-Translator
npm run dev

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :3001

# Kill processes on port if needed
sudo kill -9 $(lsof -t -i:3000)
```

### Performance Issues
```bash
# Check CPU temperature (should be <80°C)
vcgencmd measure_temp

# Monitor real-time stats
htop

# Check memory usage
free -h

# Check disk space
df -h

# If throttled, check:
vcgencmd get_throttled
# Non-zero value means throttling is occurring
```

### I2C/SPI Device Not Found
```bash
# Check I2C devices
i2cdetect -y 1

# Test specific address (e.g., 0x29 for VL53L0X)
i2cget -y 1 0x29

# If not found, check connections and power
```

---

## ❓ FAQ

**Q: Can I use a different camera?**
A: The code is designed for Raspberry Pi Camera Module 3. Other cameras (USB webcams, etc.) may require modifications to the camera streaming code.

**Q: What are the minimum specs for Raspberry Pi?**
A: Raspberry Pi 3 A+ is minimum supported. Pi 4 or 5 are recommended for better performance, especially with multiple simultaneous operations.

**Q: Can this work completely offline?**
A: Yes, except for the translation feature which requires internet. All other functions work locally.

**Q: How do I update the application?**
A: Pull the latest changes from GitHub:
```bash
cd ~/Braillescan-Mesh-Translator
git pull origin main
npm install  # If dependencies changed
sudo systemctl restart braillescan.service
```

**Q: Can I access the device from outside my network?**
A: Yes, if you configure the secondary Wi-Fi interface to connect to an internet network. The app will then be accessible via that network.

**Q: What's the battery life?**
A: Depends on the power bank capacity. A typical 20,000mAh power bank should provide 8-10 hours of continuous operation.

**Q: Can I modify the 3D models?**
A: Yes! The STL files can be imported into Blender, Fusion 360, or other CAD software and modified for your specific needs.

---

## 📊 Performance Metrics

### Expected Performance on Raspberry Pi 3 A+
- Camera frame rate: ~15 FPS (configurable)
- Translation response time: 1-3 seconds (depends on internet)
- Memory usage: ~150-200MB baseline
- CPU usage: 20-40% (single core) during streaming
- Disk space needed: ~5GB with OS, ~500MB for app

### Expected Performance on Raspberry Pi 4
- Camera frame rate: ~30 FPS possible
- Translation response time: <2 seconds
- Memory usage: ~100-150MB baseline
- CPU usage: 10-20% (with multiple cores)
- Significantly faster model inference if using local models

---

## 📝 Project Structure

```
Braillescan-Mesh-Translator/
├── src/                          # React frontend source
│   ├── App.jsx                   # Main app component
│   ├── App.css                   # Styles
│   ├── components/               # Reusable React components
│   ├── assets/                   # Images and static assets
│   └── main.jsx                  # Entry point
├── server/                       # Node.js backend
│   └── index.js                  # Express server
├── public/                       # Static files served by Vite
├── 3dmodels/                     # 3D STL files for printing
├── dist/                         # Production build output
├── package.json                  # Dependencies and scripts
├── vite.config.js                # Vite configuration
├── index.html                    # HTML template
├── LICENSE                       # MIT License
├── README.md                     # This file
└── SETUP_COMMANDS.txt            # Reference for all commands
```

---

## 🔐 Security Considerations

1. **Wi-Fi Security**: Always set a strong password for the access point
2. **SSH**: Disable password authentication, use SSH keys only
3. **API Keys**: Don't commit Google API keys to public repositories
4. **Local Network**: Keep the device on a trusted network
5. **Firewall**: Configure ufw on Raspberry Pi if exposed to untrusted networks

---

## 📚 Additional Resources

### Official Documentation
- [Raspberry Pi Documentation](https://www.raspberrypi.com/documentation/)
- [libcamera Documentation](https://libcamera.org/docs.html)
- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/en/starter/hello-world.html)

### Community & Support
- [Raspberry Pi Forums](https://forums.raspberrypi.com/)
- [Stack Overflow - Tags: raspberry-pi, react, node.js](https://stackoverflow.com/)
- GitHub Issues: Report bugs and feature requests

### Related Projects
- [OpenCV on Raspberry Pi](https://github.com/opencv/opencv)
- [TensorFlow Lite for Raspberry Pi](https://www.tensorflow.org/lite/guide/python)
- [Home Assistant](https://www.home-assistant.io/) - For IoT integration

---

# Opinia autorilor despre proiect și utilitatea acestuia

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

---

# Roadmap

Pentru etapele ulterioare ale dezvoltării propunem:

creșterea vitezei de recunoașterii

integrarea unui actuator/display Braille reîmprospătabil pentru conversia 
inversă

integrarea unui sintetizator vocal

dezvoltarea unei aplicații mobile dedicate

sincronizarea cu servicii cloud

îmbunătățirea autonomiei și optimizarea designului cadrului printat 3D pentru 
o portabilitate mai bună

integrarea sistemelor de inteligență artificială pentru optimizarea recunoașterii,
corectarea eventualelor erori si rezumarea conținutului scanat

implementarea unui sistem autofocus (focalizare automată) pentru cameră

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

### How to Contribute
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Last Updated**: July 2026  
**Maintainer**: [@DoctorBeryl](https://github.com/DoctorBeryl)

For more information, visit the [GitHub Repository](https://github.com/DoctorBeryl/Braillescan-Mesh-Translator)
