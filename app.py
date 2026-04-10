# =====================================
# 🚀 MC PANEL
# =====================================

import os, subprocess, threading, psutil, time, requests, shutil
from flask import Flask, request, session, redirect, jsonify, render_template
from pyngrok import ngrok
from ansi2html import Ansi2HTMLConverter

MC_VERSION   = "1.21.1"
SERVER_TYPE  = "paper"
ADMIN_USER   = "admin"
ADMIN_PASS   = "1234"
NGROK_AUTH_TOKEN = os.getenv("NGROK_AUTH_TOKEN")

# --- Google Drive default ---
DRIVE_MOUNTED = False
try:
    from google.colab import drive
    drive.mount('/content/drive')
    DRIVE_MOUNTED = True
    BASE_DIR = "/content/drive/MyDrive/MinecraftServer"
except:
    BASE_DIR = "/content/Minecraft-server"

os.makedirs(BASE_DIR, exist_ok=True)
os.chdir(BASE_DIR)

if not os.path.exists("/usr/bin/java"):
    os.system("apt-get update -y > /dev/null")
    os.system("apt-get install openjdk-21-jdk -y > /dev/null")

AVAILABLE_VERSIONS = ["1.21.4","1.21.3","1.21.1","1.20.6","1.20.4","1.20.1","1.19.4"]
AVAILABLE_TYPES    = ["paper","purpur","vanilla"]

def download_server(version, stype):
    jar = f"server-{stype}-{version}.jar"
    if os.path.exists(jar):
        return jar
    print(f"📦 Downloading {stype} {version}...")
    if stype == "paper":
        api = f"https://api.papermc.io/v2/projects/paper/versions/{version}"
        builds = requests.get(api).json().get("builds", [])
        if not builds: raise Exception(f"No Paper builds for {version}")
        latest = builds[-1]
        url = f"https://api.papermc.io/v2/projects/paper/versions/{version}/builds/{latest}/downloads/paper-{version}-{latest}.jar"
    elif stype == "purpur":
        url = f"https://api.purpurmc.org/v2/purpur/{version}/latest/download"
    elif stype == "vanilla":
        manifest = requests.get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json").json()
        ver_info = next((v for v in manifest["versions"] if v["id"] == version), None)
        if not ver_info: raise Exception(f"Vanilla {version} not found")
        ver_data = requests.get(ver_info["url"]).json()
        url = ver_data["downloads"]["server"]["url"]
    else:
        raise Exception("Unsupported type")
    open(jar,"wb").write(requests.get(url).content)
    return jar

open("eula.txt","w").write("eula=true")

server = None
running = False
starting = False
current_version = MC_VERSION
current_type = SERVER_TYPE
logs = []
players = set()
ram_hist = []
tps_hist = []
mc_ip = "Server Offline"
mc_tunnel = None

def get_max_ram():
    total_gb = psutil.virtual_memory().total / (1024**3)
    return f"{max(1, int(total_gb - 1))}G"

def parse_log(line):
    if "joined the game" in line:
        name = line.split()[0] if line.split() else ""
        if name: players.add(name)
    if "left the game" in line:
        name = line.split()[0] if line.split() else ""
        if name: players.discard(name)

def colorize(line):
    if "ERROR" in line: return f"\x1b[31m{line}\x1b[0m"
    if "WARN"  in line: return f"\x1b[33m{line}\x1b[0m"
    if "joined" in line: return f"\x1b[32m{line}\x1b[0m"
    return line

def start_server(version, stype):
    global server, running, current_version, current_type
    if running: return
    jar = download_server(version, stype)
    open("eula.txt","w").write("eula=true")
    ram = get_max_ram()
    server = subprocess.Popen(
        ["/usr/lib/jvm/java-21-openjdk-amd64/bin/java",
         f"-Xmx{ram}", f"-Xms{ram}", "-jar", jar, "nogui"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True
    )
    running = True
    current_version = version
    current_type = stype
    def read():
        for line in server.stdout:
            line = line.strip()
            parse_log(line)
            logs.append(colorize(line))
            if len(logs) > 500: logs.pop(0)
    threading.Thread(target=read, daemon=True).start()

def stop_server():
    global running
    if server:
        try: server.stdin.write("stop\n"); server.stdin.flush()
        except: pass
    running = False

def send_cmd(cmd):
    if server:
        server.stdin.write(cmd + "\n")
        server.stdin.flush()

def update_stats():
    ram = round(psutil.virtual_memory().used/1e9, 2)
    tps = round(18 + (2 * (time.time()%1)), 2)
    ram_hist.append(ram); tps_hist.append(tps)
    if len(ram_hist) > 20: ram_hist.pop(0); tps_hist.pop(0)
    return ram_hist, tps_hist

app = Flask(__name__)
app.secret_key = "secret"
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
PANEL_URL = ngrok.connect(5000).public_url
conv = Ansi2HTMLConverter(inline=True)

@app.route("/", methods=["GET","POST"])
def login():
    if request.method == "POST":
        if request.form["u"] == ADMIN_USER and request.form["p"] == ADMIN_PASS:
            session["user"] = True
            return redirect("/panel")
    return render_template("login.html")

@app.route("/panel")
def panel():
    if "user" not in session: return redirect("/")
    return render_template("dashboard.html")

@app.route("/start")
def start():
    global starting, mc_ip, mc_tunnel
    version = request.args.get("version", current_version)
    stype   = request.args.get("type", current_type)
    if running or starting: return "busy"
    starting = True; mc_ip = "Starting..."
    def run():
        global starting, mc_ip, mc_tunnel
        start_server(version, stype)
        time.sleep(4)
        try:
            mc_tunnel = ngrok.connect(25565,"tcp")
            mc_ip = mc_tunnel.public_url.replace("tcp://","")
        except: mc_ip = "Tunnel Error"
        starting = False
    threading.Thread(target=run, daemon=True).start()
    return "ok"

@app.route("/stop")
def stop():
    global starting, mc_ip
    stop_server(); starting = False; mc_ip = "Server Offline"
    if mc_tunnel:
        try: ngrok.disconnect(mc_tunnel.public_url)
        except: pass
    return "ok"

@app.route("/cmd", methods=["POST"])
def cmd():
    send_cmd(request.form["cmd"]); return "ok"

@app.route("/server_info")
def server_info():
    return jsonify({
        "version": current_version, "type": current_type,
        "available_versions": AVAILABLE_VERSIONS,
        "available_types": AVAILABLE_TYPES,
        "drive_mounted": DRIVE_MOUNTED, "base_dir": BASE_DIR,
    })

@app.route("/set_server", methods=["POST"])
def set_server():
    global current_version, current_type
    if running: return jsonify({"error": "Stop server first"}), 400
    d = request.json
    current_version = d.get("version", current_version)
    current_type    = d.get("type", current_type)
    return jsonify({"ok": True, "version": current_version, "type": current_type})

@app.route("/logs")
def get_logs():
    return conv.convert("<br>".join(logs), full=False)

@app.route("/stats")
def stats():
    r,t = update_stats()
    return jsonify({"running":running,"starting":starting,"ram":r,"tps":t,"ip":mc_ip,
                    "version":current_version,"type":current_type})

@app.route("/players")
def get_players():
    return jsonify(list(players))

@app.route("/files_json")
def files():
    try:
        entries = []
        for f in sorted(os.listdir(".")):
            path = os.path.join(".", f)
            stat = os.stat(path)
            entries.append({"name":f,"is_dir":os.path.isdir(path),
                            "size":stat.st_size,"modified":round(stat.st_mtime)})
        return jsonify(entries)
    except Exception as e:
        return jsonify({"error":str(e)}), 500

@app.route("/file")
def get_file():
    name = request.args.get("name")
    if not name: return "No file",400
    try: return open(name, errors="replace").read()
    except Exception as e: return str(e),500

@app.route("/save_file", methods=["POST"])
def save():
    d = request.json
    try: open(d["name"],"w").write(d["content"]); return "ok"
    except Exception as e: return str(e),500

@app.route("/delete_file", methods=["POST"])
def delete_file():
    name = request.json.get("name")
    if not name: return "No name",400
    try:
        path = os.path.join(".", name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
        return "ok"
    except Exception as e: return str(e),500

@app.route("/rename_file", methods=["POST"])
def rename_file():
    d = request.json; old,new = d.get("old"),d.get("new")
    if not old or not new: return "Missing",400
    try: os.rename(os.path.join(".",old), os.path.join(".",new)); return "ok"
    except Exception as e: return str(e),500

@app.route("/upload", methods=["POST"])
def upload():
    f = request.files["file"]; f.save(f.filename); return "ok"

@app.route("/search_plugin")
def search_plugin():
    q = request.args.get("q","")
    res = requests.get(
        f'https://api.modrinth.com/v2/search?query={q}&facets=[["project_type:plugin"]]&limit=12'
    ).json()
    return jsonify([{
        "name": x.get("title",""), "id": x.get("project_id",""),
        "description": x.get("description",""), "downloads": x.get("downloads",0),
        "follows": x.get("follows",0), "icon_url": x.get("icon_url",""),
        "author": x.get("author",""), "categories": x.get("categories",[]),
        "game_versions": (x.get("versions") or [])[-3:],
        "source_url": f"https://modrinth.com/plugin/{x.get('slug',x.get('project_id',''))}",
    } for x in res.get("hits",[])])

@app.route("/install_plugin")
def install_plugin():
    pid = request.args.get("id")
    v   = requests.get(f"https://api.modrinth.com/v2/project/{pid}/version").json()[0]
    url = v["files"][0]["url"]; name = v["files"][0]["filename"]
    os.makedirs("plugins", exist_ok=True)
    open(f"plugins/{name}","wb").write(requests.get(url).content)
    return "ok"

print("🌐 Panel:", PANEL_URL)
app.run(host="0.0.0.0", port=5000)