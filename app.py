# =====================================
# 🚀 MC COLAB PANEL - FINAL SAFE VERSION
# =====================================

import os, subprocess, threading, psutil, time, requests
from flask import Flask, request, session, redirect, jsonify, send_from_directory, render_template
from pyngrok import ngrok
from ansi2html import Ansi2HTMLConverter

# =====================================
# 📁 SAFE ENV (COLAB / LOCAL)
# =====================================

try:
    from google.colab import drive
    drive.mount('/content/drive')
    BASE_DIR = "/content/drive/MyDrive/MinecraftSaaS"
    print("✅ Running in Colab")
except:
    BASE_DIR = "/content/Minecraft-server"
    print("💻 Running locally")

os.makedirs(BASE_DIR, exist_ok=True)
os.chdir(BASE_DIR)

# =====================================
# 🔐 CONFIG
# =====================================

ADMIN_USER = "admin"
ADMIN_PASS = "1234"
import os
NGROK_AUTH_TOKEN = os.getenv("NGROK_AUTH_TOKEN")

# =====================================
# ⚙️ INSTALL JAVA (SAFE)
# =====================================

if not os.path.exists("/usr/bin/java"):
    print("⚙️ Installing Java...")
    os.system("apt-get update -y > /dev/null")
    os.system("apt-get install openjdk-21-jdk -y > /dev/null")

# =====================================
# 📦 DOWNLOAD SERVER (PAPER)
# =====================================

if not os.path.exists("server.jar"):
    print("📦 Downloading Minecraft server...")
    api = "https://api.papermc.io/v2/projects/paper/versions/1.21.1"
    builds = requests.get(api).json()["builds"]
    latest = builds[-1]

    jar = f"https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds/{latest}/downloads/paper-1.21.1-{latest}.jar"
    open("server.jar", "wb").write(requests.get(jar).content)

open("eula.txt", "w").write("eula=true")

# =====================================
# 🧠 SERVER ENGINE
# =====================================

server = None
running = False
logs = []
players = set()
ram_hist = []
tps_hist = []

def parse_log(line):
    if "joined the game" in line:
        players.add(line.split(" ")[0])
    if "left the game" in line:
        players.discard(line.split(" ")[0])

def colorize(line):
    if "ERROR" in line:
        return f"\x1b[31m{line}\x1b[0m"
    if "WARN" in line:
        return f"\x1b[33m{line}\x1b[0m"
    if "joined the game" in line:
        return f"\x1b[32m{line}\x1b[0m"
    return line

def start_server():
    global server, running
    if running:
        return

    print("🚀 Starting server...")
    cmd = "java -Xmx6G -Xms6G -jar server.jar nogui"

    server = subprocess.Popen(
        cmd.split(),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    running = True

    def read_logs():
        for line in server.stdout:
            line = line.strip()
            parse_log(line)
            logs.append(colorize(line))

            if len(logs) > 500:
                logs.pop(0)

    threading.Thread(target=read_logs, daemon=True).start()

def stop_server():
    global running
    if server:
        server.terminate()
    running = False

def send_cmd(cmd):
    if server:
        server.stdin.write(cmd + "\n")
        server.stdin.flush()

# =====================================
# 📊 STATS
# =====================================

def update_stats():
    ram = round(psutil.virtual_memory().used / 1e9, 2)
    tps = round(18 + (2 * (time.time() % 1)), 2)

    ram_hist.append(ram)
    tps_hist.append(tps)

    if len(ram_hist) > 20:
        ram_hist.pop(0)
        tps_hist.pop(0)

    return ram_hist, tps_hist

# =====================================
# 🌐 FLASK APP
# =====================================

app = Flask(__name__)
app.secret_key = "secret"

# NGROK
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
PUBLIC_URL = ngrok.connect(5000).public_url

# ANSI converter
conv = Ansi2HTMLConverter(inline=True)

# =====================================
# 📂 STATIC ROUTE
# =====================================

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

# =====================================
# 🔐 AUTH
# =====================================

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form["u"] == ADMIN_USER and request.form["p"] == ADMIN_PASS:
            session["user"] = True
            return redirect("/panel")
    return render_template("login.html")

@app.route("/panel")
def panel():
    if "user" not in session:
        return redirect("/")
    return render_template("dashboard.html")

# =====================================
# ⚡ API ROUTES
# =====================================

@app.route("/start")
def start():
    start_server()
    return "ok"

@app.route("/stop")
def stop():
    stop_server()
    return "ok"

@app.route("/cmd", methods=["POST"])
def cmd():
    send_cmd(request.form["cmd"])
    return "ok"

@app.route("/logs")
def get_logs():
    return conv.convert("<br>".join(logs), full=False)

@app.route("/stats")
def stats():
    r, t = update_stats()
    return jsonify({
        "running": running,
        "ram": r,
        "tps": t,
        "ip": PUBLIC_URL
    })

@app.route("/players")
def get_players():
    return list(players)

@app.route("/files_json")
def files():
    return os.listdir(".")

@app.route("/file")
def get_file():
    return open(request.args.get("name")).read()

@app.route("/save_file", methods=["POST"])
def save_file():
    d = request.json
    open(d["name"], "w").write(d["content"])
    return "ok"

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["file"]
    f.save(f.filename)
    return "ok"

# =====================================
# 🔌 PLUGINS (MODRINTH)
# =====================================

@app.route("/search_plugin")
def search_plugin():
    q = request.args.get("q")
    res = requests.get(f"https://api.modrinth.com/v2/search?query={q}").json()
    return [{"name": x["title"], "id": x["project_id"]} for x in res["hits"][:5]]

@app.route("/install_plugin")
def install_plugin():
    pid = request.args.get("id")
    versions = requests.get(f"https://api.modrinth.com/v2/project/{pid}/version").json()

    url = versions[0]["files"][0]["url"]
    os.makedirs("plugins", exist_ok=True)

    open(f"plugins/{pid}.jar", "wb").write(requests.get(url).content)
    return "ok"

# =====================================
# 🚀 RUN
# =====================================

print("🌐 Panel URL:", PUBLIC_URL)
app.run(host="0.0.0.0", port=5000)ram_hist=[]
tps_hist=[]

def parse(line):
    if "joined the game" in line: players.add(line.split(" ")[0])
    if "left the game" in line: players.discard(line.split(" ")[0])

def color(line):
    if "ERROR" in line: return f"\x1b[31m{line}\x1b[0m"
    if "WARN" in line: return f"\x1b[33m{line}\x1b[0m"
    if "joined" in line: return f"\x1b[32m{line}\x1b[0m"
    return line

def start_server():
    global server,running
    if running: return
    server=subprocess.Popen("java -Xmx6G -Xms6G -jar server.jar nogui".split(),
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    running=True
    def read():
        for line in server.stdout:
            parse(line)
            logs.append(color(line.strip()))
            if len(logs)>500: logs.pop(0)
    threading.Thread(target=read,daemon=True).start()

def stop_server():
    global running
    if server: server.terminate()
    running=False

def send_cmd(cmd):
    if server:
        server.stdin.write(cmd+"\n")
        server.stdin.flush()

# ===== STATS =====
def stats():
    ram=round(psutil.virtual_memory().used/1e9,2)
    tps=round(18+(2*(time.time()%1)),2)
    ram_hist.append(ram)
    tps_hist.append(tps)
    if len(ram_hist)>20:
        ram_hist.pop(0)
        tps_hist.pop(0)
    return ram_hist,tps_hist

# ===== APP =====
app=Flask(__name__)
app.secret_key="secret"

ngrok.set_auth_token(NGROK_AUTH_TOKEN)
PUBLIC_URL=ngrok.connect(5000).public_url

conv=Ansi2HTMLConverter(inline=True)

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route("/",methods=["GET","POST"])
def login():
    if request.method=="POST":
        if request.form["u"]==ADMIN_USER and request.form["p"]==ADMIN_PASS:
            session["user"]=1
            return redirect("/panel")
    return render_template("login.html")

@app.route("/panel")
def panel():
    if "user" not in session: return redirect("/")
    return render_template("dashboard.html")

@app.route("/start")
def start(): start_server(); return "ok"

@app.route("/stop")
def stop(): stop_server(); return "ok"

@app.route("/cmd",methods=["POST"])
def cmd(): send_cmd(request.form["cmd"]); return "ok"

@app.route("/logs")
def get_logs():
    return conv.convert("<br>".join(logs), full=False)

@app.route("/stats")
def get_stats():
    r,t=stats()
    return jsonify({"running":running,"ram":r,"tps":t,"ip":PUBLIC_URL})

@app.route("/players")
def get_players(): return list(players)

@app.route("/files_json")
def files(): return os.listdir(".")

@app.route("/file")
def file(): return open(request.args.get("name")).read()

@app.route("/save_file",methods=["POST"])
def save():
    d=request.json
    open(d["name"],"w").write(d["content"])
    return "ok"

@app.route("/upload",methods=["POST"])
def upload():
    f=request.files["file"]
    f.save(f.filename)
    return "ok"

@app.route("/search_plugin")
def search_plugin():
    q=request.args.get("q")
    res=requests.get(f"https://api.modrinth.com/v2/search?query={q}").json()
    return [{"name":x["title"],"id":x["project_id"]} for x in res["hits"][:5]]

@app.route("/install_plugin")
def install():
    pid=request.args.get("id")
    v=requests.get(f"https://api.modrinth.com/v2/project/{pid}/version").json()
    url=v[0]["files"][0]["url"]
    os.makedirs("plugins",exist_ok=True)
    open(f"plugins/{pid}.jar","wb").write(requests.get(url).content)
    return "ok"

print("🌐 Panel:", PUBLIC_URL)
app.run(host="0.0.0.0",port=5000)
