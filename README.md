# Braillescan-Mesh-Translator
BrailleScan Mesh Translator este un dispozitiv bazat pe Raspberry Pi care recunoaște și traduce text Braille și text tipărit, utilizând o cameră cu lentilă macro, senzori, o interfață web și un afișaj LCD.

# BrailleScan Mesh Translator -- Documentație

## Descrierea problemei pe care încercăm să o rezolvăm

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

Se instalează sistemul de operare Raspberry Pi OS pe cardul microSD.

Se conectează:

camera macro;

senzorii;

display-ul LCD;

modulele de comunicație;

bateria și sistemul de alimentare.

Se configurează rețeaua Wi-Fi Access Point.

In cazul unui adaptor extern de Wi-Fi se instaleaza drivere necesare
funcționării acestuia în sistemul de operare Linux (Debian/Raspberry 
Pi OS)

Se cloneaza proiectul din Github pe Raspberry Pi

se configureaza o unitate de serviciu systemd care ruleaza aplicatia
full-stack la pornirea sistemului (boot).

Se instalează toate dependențele software necesare aplicației.

Utilizatorul se conectează la rețeaua Wi-Fi creată de dispozitiv.

Din browser se accesează adresa locală a aplicației.

Optional: se conecteaza la reteaua secundara prin intermediul aplicatiei
web

Se verifică funcționarea camerei.

După calibrare, dispozitivul este pregătit pentru utilizare.

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

# Roadmap

Pentru etapele ulterioare ale dezvoltării propunem:

creșterea vitezei de recunoaștere

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
