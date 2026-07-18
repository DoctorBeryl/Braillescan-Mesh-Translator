# BrailleScan Mesh Translator

**Dispozitiv bazat pe Raspberry Pi care recunoaște și traduce text Braille și text tipărit, utilizând o cameră cu lentilă macro, senzori, o interfață web și un afișaj LCD.**

---

### Documentele esențiale:

| Document | Descriere | Link |
|----------|-----------|------|
| **DOCUMENTATIE** | [Documentatie](#descrierea-problemei-pe-care-o-rezolvăm) |
| **COMENZI SETUP** | [SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt) |
| **Hardware Necesar** | [Vezi mai jos](#cerințe-hardware) |
| **Modele 3D** | [3dmodels/](./3dmodels/) |

---

## Comenzi Rapide - Setup Website

```bash
git clone https://github.com/DoctorBeryl/Braillescan-Mesh-Translator.git
cd Braillescan-Mesh-Translator
npm install
npm install concurrent --save-dev
npm run dev
```

Accesare: http://192.168.100.184:3000

**Instalare completă:** [SETUP_COMMANDS.txt](./SETUP_COMMANDS.txt)

---

## Stack Tehnologic

- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Backend:** Node.js, Express 5
- **Hardware:** libcamera/rpicam, nmcli, I2C/SPI
- **Tools:** Oxlint, Concurrently

---

## Dependințe

### Runtime
| Pachet | Versiune | Scop |
|--------|----------|------|
| react | ^19.2.7 | Framework UI |
| express | ^5.1.0 | Server HTTP |
| @google/model-viewer | ^4.3.1 | Vizualizare 3D |
| @vitalets/google-translate-api | ^9.2.1 | Traducere |
| lucide-react | ^1.24.0 | Pictograme |

### Sistem
- Raspberry Pi 3 A+ (sau mai nou)
- Raspberry Pi OS Bookworm
- Node.js 18+
- libcamera/rpicam
- i2c-tools

---

## Cerințe Hardware

- Raspberry Pi 3 A+ (Pi 4/5 recomandat)
- Card microSD 32GB+
- Sursă 5V/2A
- Camera Raspberry Pi Module 3 cu lentilă macro
- Display LCD I2C/SPI (16x2 sau 20x4)
- Senzori distanță (VL53L0X)
- Wi-Fi încorporat

**Modele 3D:** Disponibile în directorul `3dmodels/` pentru tipărire

---

## Cuprins

- [Descrierea Problemei](#descrierea-problemei-pe-care-o-rezolvăm)
- [Soluția Propusă](#descrierea-soluției-propuse)
- [Publicul Țintă](#definirea-publicului-țintă)
- [Funcționalități](#prezentarea-funcționalităților-aplicației)
- [Arhitectura](#arhitectura-aplicației)
- [Puncte Forte](#elemente-distinctive-ale-aplicației--puncte-forte)
- [Justificare Tehnologii](#justificarea-folosirii-tehnologiilor-alese)
- [Opinia Autorilor](#opinia-autorilor-despre-proiect)
- [Roadmap](#roadmap)

---

# BrailleScan Mesh Translator — Documentație Proiect

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
tradus automat în alfabetul latin și afișat pe interfața web.
Totodată, aparatul oferă indicații în timp real despre poziția optimă a
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

- Persoanelor cu deficiențe de vedere
- Profesorilor care predau alfabetul Braille
- Instituțiilor de învățământ special
- Bibliotecilor pentru nevăzători
- Membrilor familiei persoanelor nevăzătoare
- Voluntarilor și organizațiilor care lucrează în domeniul incluziunii sociale

De asemenea, dispozitivul poate fi utilizat în scop educațional pentru
familiarizarea persoanelor fără deficiențe de vedere cu sistemul Braille.

## Prezentarea Funcționalităților Aplicației

Principalele funcționalități ale sistemului sunt:

- Recunoașterea caracterelor Braille utilizând camera macro și senzorii dedicați
- Traducerea automată a textului Braille în alfabetul latin
- Recunoașterea textului tipărit prin tehnologia OCR
- Afișarea indicațiilor în timp real pe display-ul LCD
- Reconstruirea unei reprezentări 3D a textului Braille
- Accesarea unei interfețe web moderne prin intermediul browserului
- Funcționarea independentă într-o rețea Wi-Fi creată de Raspberry Pi
- Posibilitatea conectării la Internet printr-o a doua interfață wireless
- Administrarea și configurarea dispozitivului din interfața web

## Arhitectura Aplicației

Sistemul este alcătuit din două componente principale:

**Dispozitivul Raspberry Pi** - Nucleul aplicației:
- Rularea sistemului de operare Linux
- Controlul camerei și al senzorilor
- Capturarea și distribuirea imaginilor pentru procesare
- Găzduirea aplicației web
- Streamingul camerei live pe interfață
- Administrarea rețelei locale

Raspberry Pi creează o rețea Wi-Fi proprie (Access Point). Opțional, poate folosi o a doua interfață Wi-Fi pentru conectarea la Internet. Hardware-ul este montat într-un cadru printat 3D modular. Dispozitivul necesită 5V la 2A. Utilizarea unui acumulator portabil permite funcționarea mobilă.

**Dispozitivul Host** - Orice calculator, tabletă sau telefon mobil cu browser web modern care comunică prin HTTP cu dispozitivul.

## Elemente Distinctive ale Aplicației — Puncte Forte

- Captură de imagini în mod macro pentru analizarea reliefului Braille
- Combinarea informațiilor provenite din senzori și procesarea imaginilor
- Suport simultan pentru traducerea Braille și OCR
- Traducerea directă în sau din diferite limbi străine
- Funcționalitate offline
- Interfață web multiplatformă, fără aplicații dedicate
- Cost redus comparativ cu echipamentele comerciale
- Arhitectură modulară și extensibilă

## Justificarea Folosirii Tehnologiilor Alese

Platforma Raspberry Pi 3 A+ oferă un raport excelent între performanță, consum energetic și cost. Dispune de suficientă putere de procesare pentru analizarea imaginilor în timp real și permite integrarea facilă cu camere și senzori. Linux oferă stabilitate și suport extins pentru biblioteci open-source.

Interfața web este independentă de sistemul de operare și poate fi accesată de pe orice dispozitiv cu browser. Camera cu lentilă macro permite captarea fidelă a reliefului Braille. Alegerea acestor tehnologii conduce la un sistem flexibil, ușor de întreținut și extensibil.

## Opinia Autorilor despre Proiect

Considerăm că beneficiile tehnologiei trebuie să fie disponibile unui
număr cât mai mare de persoane. Asistența persoanelor cu dizabilități
reprezintă un scop important al acestui proiect. Noi am realizat
o soluție bazată pe componente relativ accesibile.

Un profesor care primește o lucrare redactată în Braille poate utiliza
BrailleScan Mesh Translator pentru a obține rapid traducerea în alfabetul latin.
Membrii familiei pot înțelege mai ușor mesajele scrise în Braille,
facilitând comunicarea zilnică.

## Roadmap

Pentru etapele ulterioare ale dezvoltării propunem:

- Creșterea vitezei de recunoaștere
- Integrarea unui display Braille reîmprospătabil pentru conversia inversă
- Integrarea unui sintetizator vocal
- Dezvoltarea unei aplicații mobile dedicate
- Sincronizarea cu servicii cloud
- Îmbunătățirea autonomiei și optimizarea designului cadrului printat 3D
- Integrarea sistemelor de inteligență artificială pentru optimizarea recunoașterii
- Implementarea unui sistem autofocus pentru cameră

**Repository:** https://github.com/DoctorBeryl/Braillescan-Mesh-Translator
**Mentenanță:** [@DoctorBeryl](https://github.com/DoctorBeryl)
