// =============================================
// MC COLAB PANEL — console.js (Improved Live Streaming)
// =============================================

let lastLogIndex = 0;  // Track which logs we've already displayed
let updateInProgress = false;

function clearConsole() {
  document.getElementById('console-output').innerHTML = '';
  lastLogIndex = 0;  // Reset the tracking index so we'll get all logs on next update
}

async function updateConsole() {
  // Prevent multiple simultaneous updates
  if (updateInProgress) return;
  updateInProgress = true;
  
  try {
    const response = await fetch(`/logs-stream?since=${lastLogIndex}`);
    if (!response.ok) throw new Error('Failed to fetch logs');
    
    const data = await response.json();
    const el = document.getElementById('console-output');
    
    // Only update if there are new logs
    if (data.new_count > 0) {
      data.logs.forEach(htmlLine => {
        // Server already converted ANSI codes to HTML spans
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = htmlLine;
        logEntry.style.animation = 'logEntry-fade 0.3s ease-out';
        
        el.appendChild(logEntry);
      });
      
      // Update our tracking index
      lastLogIndex = data.total;
      
      // Auto-scroll to bottom smoothly
      el.scrollTop = el.scrollHeight;
    }
  } catch (e) {
    console.error('Console update error:', e);
  } finally {
    updateInProgress = false;
  }
}


function sendCmd() {
  const input = document.getElementById('cmd');
  const cmd = input.value.trim();
  if (!cmd) return;

  fetch('/cmd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'cmd=' + encodeURIComponent(cmd)
  });

  input.value = '';
  showToast('Command sent: ' + cmd);
}

// Update console more frequently for smooth streaming
setInterval(updateConsole, 500);  // 500ms for smooth real-time feel
