# =====================================
# 🚀 MC PANEL FINAL (AUTO VERSION + MAX RAM)
# =====================================

import os, subprocess, threading, psutil, time, requests
from flask import Flask, request, session, redirect, jsonify, render_template
from pyngrok import ngrok
from ansi2html import Ansi2HTMLConverter

# =====================================
# ⚙️ CONFIG (LIKE COLAB CELL)
# =====================================

MC_VERSION = "1.21.1"   # 🔥 CHANGE VERSION HERE
SERVER_TYPE = "paper"   # paper / (future: purpur, vanilla)

ADMIN_USER = "admin"
ADMIN_PASS = "1234"
NGROK_AUTH_TOKEN = os.getenv("NGROK_AUTH_TOKEN")

# =====================================
# 📁 ENV SETUP
# =====================================

try:
    from google.colab import drive
    drive.mount('/content/drive')
    BASE_DIR = "/content/drive/MyDrive/MinecraftSaaS"
except:
    BASE_DIR = "/content/Minecraft-server"

os.makedirs(BASE_DIR, exist_ok=True)
os.chdir(BASE_DIR)

# =====================================
# ☕ JAVA
# =====================================

if not os.path.exists("/usr/bin/java"):
    os.system("apt-get update -y > /dev/null")
    os.system("apt-get install openjdk-21-jdk -y > /dev/null")

# =====================================
# 📦 DOWNLOAD SERVER (AUTO VERSION)
# =====================================

def download_server():
    if os.path.exists("server.jar"):
        return

    print(f"📦 Downloading {SERVER_TYPE} {MC_VERSION}...")

    if SERVER_TYPE == "paper":
        api = f"https://api.papermc.io/v2/projects/paper/versions/{MC_VERSION}"
        builds = requests.get(api).json()["builds"]
        latest = builds[-1]

        jar_url = f"https://api.papermc.io/v2/projects/paper/versions/{MC_VERSION}/builds/{latest}/downloads/paper-{MC_VERSION}-{latest}.jar"

    else:
        raise Exception("Unsupported server type")

    open("server.jar", "wb").write(requests.get(jar_url).content)

download_server()

# =====================================
# 📜 AUTO EULA
# =====================================

open("eula.txt", "w").write("eula=true")

# =====================================
# 🧠 STATE
# =====================================

server = None
running = False
starting = False

logs = []
players = set()

ram_hist = []
tps_hist = []

mc_ip = "Server Offline"
mc_tunnel = None

# =====================================
# 🧠 RAM AUTO DETECT
# =====================================

def get_max_ram():
    total_gb = psutil.virtual_memory().total / (1024**3)

    # keep 1GB safe for system
    usable = max(1, int(total_gb - 1))

    return f"{usable}G"

# =====================================
# 📜 LOG PARSER
# =====================================

def parse_log(line):
    if "joined the game" in line:
        players.add(line.split()[0])
    if "left the game" in line:
        players.discard(line.split()[0])

def colorize(line):
    if "ERROR" in line:
        return f"\x1b[31m{line}\x1b[0m"
    if "WARN" in line:
        return f"\x1b[33m{line}\x1b[0m"
    if "joined the game" in line:
        return f"\x1b[32m{line}\x1b[0m"
    return line

# =====================================
# 🚀 SERVER CONTROL (MAX RAM)
# =====================================

def start_server():
    global server, running

    if running:
        return

    ram = get_max_ram()
    print(f"🚀 Starting with RAM: {ram}")

    server = subprocess.Popen(
        ["java", f"-Xmx{ram}", f"-Xms{ram}", "-jar","server.jar","nogui"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    running = True

    def read():
        for line in server.stdout:
            line = line.strip()
            parse_log(line)
            logs.append(colorize(line))

            if len(logs) > 500:
                logs.pop(0)

    threading.Thread(target=read, daemon=True).start()

def stop_server():
    global running

    if server:
        try:
            server.stdin.write("stop\n")
            server.stdin.flush()
        except:
            pass

    running = False

def send_cmd(cmd):
    if server:
        server.stdin.write(cmd + "\n")
        server.stdin.flush()

# =====================================
# 📊 STATS
# =====================================

def update_stats():
    ram = round(psutil.virtual_memory().used/1e9,2)
    tps = round(18 + (2 * (time.time()%1)),2)

    ram_hist.append(ram)
    tps_hist.append(tps)

    if len(ram_hist)>20:
        ram_hist.pop(0)
        tps_hist.pop(0)

    return ram_hist, tps_hist

# =====================================
# 🌐 APP
# =====================================

app = Flask(__name__)
app.secret_key = "secret"

ngrok.set_auth_token(NGROK_AUTH_TOKEN)
PANEL_URL = ngrok.connect(5000).public_url

conv = Ansi2HTMLConverter(inline=True)

# =====================================
# 🔐 LOGIN
# =====================================

@app.route("/", methods=["GET","POST"])
def login():
    if request.method=="POST":
        if request.form["u"]==ADMIN_USER and request.form["p"]==ADMIN_PASS:
            session["user"]=True
            return redirect("/panel")
    return render_template("login.html")

@app.route("/panel")
def panel():
    if "user" not in session:
        return redirect("/")
    return render_template("dashboard.html")

# =====================================
# ⚡ SERVER ROUTES
# =====================================

@app.route("/start")
def start():
    global starting, mc_ip, mc_tunnel

    if running or starting:
        return "busy"

    starting = True
    mc_ip = "Starting..."

    def run():
        global starting, mc_ip, mc_tunnel

        start_server()
        time.sleep(4)

        try:
            mc_tunnel = ngrok.connect(25565,"tcp")
            mc_ip = mc_tunnel.public_url.replace("tcp://","")
        except:
            mc_ip = "Tunnel Error"

        starting = False

    threading.Thread(target=run, daemon=True).start()
    return "ok"

@app.route("/stop")
def stop():
    global starting, mc_ip

    stop_server()
    starting = False
    mc_ip = "Server Offline"

    if mc_tunnel:
        try: ngrok.disconnect(mc_tunnel.public_url)
        except: pass

    return "ok"

@app.route("/cmd", methods=["POST"])
def cmd():
    send_cmd(request.form["cmd"])
    return "ok"

# =====================================
# 📊 DATA
# =====================================

@app.route("/logs")
def get_logs():
    return conv.convert("<br>".join(logs), full=False)

@app.route("/stats")
def stats():
    r,t = update_stats()
    return jsonify({
        "running": running,
        "starting": starting,
        "ram": r,
        "tps": t,
        "ip": mc_ip
    })

@app.route("/players")
def get_players():
    return list(players)

# =====================================
# 📁 FILES
# =====================================

@app.route("/files_json")
def files():
    return os.listdir(".")

@app.route("/file")
def get_file():
    return open(request.args.get("name")).read()

@app.route("/save_file", methods=["POST"])
def save():
    d = request.json
    open(d["name"],"w").write(d["content"])
    return "ok"

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["file"]
    f.save(f.filename)
    return "ok"

# =====================================
# 🔌 PLUGINS
# =====================================

@app.route("/search_plugin")
def search_plugin():
    q=request.args.get("q")
    res=requests.get(f"https://api.modrinth.com/v2/search?query={q}").json()
    return [{"name":x["title"],"id":x["project_id"]} for x in res["hits"][:5]]

@app.route("/install_plugin")
def install_plugin():
    pid=request.args.get("id")
    v=requests.get(f"https://api.modrinth.com/v2/project/{pid}/version").json()[0]
    url=v["files"][0]["url"]

    os.makedirs("plugins",exist_ok=True)
    open(f"plugins/{pid}.jar","wb").write(requests.get(url).content)

    return "ok"

# =====================================
# 🚀 RUN
# =====================================

print("🌐 Panel:", PANEL_URL)
app.run(host="0.0.0.0", port=5000)