import { useState, useRef, useCallback, useEffect, Component } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import WalletProvider from './WalletProvider.jsx'
import { GIPSY_LOGO } from './logo.js'

// ============================================================
// CONFIG
// ============================================================
const SHELBY_BASE_URL = 'https://api.shelbynet.shelby.xyz/shelby'
const SHELBY_SESSION_TOKEN = 'YOUR_SESSION_TOKEN'
const USE_MOCK = SHELBY_SESSION_TOKEN === 'YOUR_SESSION_TOKEN'

// ============================================================
// Design tokens
// ============================================================
const mono = "'Space Mono', monospace"
const display = "'Syne', sans-serif"
const C = {
  bg: '#060d0a', surface: '#0c1812', surfaceAlt: '#0a1520',
  green: '#00ff88', cyan: '#00ccff', purple: '#a78bfa',
  amber: '#fbbf24', red: '#ff6b6b', muted: '#ffffff33', dim: '#ffffff12',
}

// ============================================================
// MOCK helpers
// ============================================================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function mockUpload(file) {
  await sleep(1200)
  const blobId = 'shby_' + Math.random().toString(36).slice(2, 18).toUpperCase()
  return {
    blobId,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    region: ['us-east-1', 'eu-west-2', 'ap-southeast-1'][Math.floor(Math.random() * 3)],
    aptosHash: '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
    rights: 'CC-BY-4.0',
    servedFrom: 'shelbynet-node-' + Math.floor(Math.random() * 999 + 100),
    cryptoSig: Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
    _mockFile: file,
  }
}

async function mockRetrieve(blobId, receipts) {
  await sleep(900)
  const receipt = receipts.find(r => r.blobId === blobId)
  if (!receipt) throw new Error('Blob not found in this session')
  return {
    receipt,
    retrievedAt: new Date().toISOString(),
    latencyMs: Math.floor(Math.random() * 80 + 12),
    node: 'shelbynet-node-' + Math.floor(Math.random() * 999 + 100),
    retrieveSig: Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
  }
}

// ============================================================
// Utils
// ============================================================
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
function copyToClipboard(text) { navigator.clipboard?.writeText(text).catch(() => {}) }
function toAddrStr(addr) { return addr ? (typeof addr === 'string' ? addr : addr.toString?.() ?? String(addr)) : '' }
function shortAddr(addr) { const s = toAddrStr(addr); return s ? s.slice(0, 6) + '…' + s.slice(-4) : '' }

// ============================================================
// Atoms
// ============================================================
function GlowDot({ color = C.green, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}, 0 0 14px ${color}55` }} />
}
function Tag({ children, color = C.green }) {
  return <span style={{ fontSize: 10, fontFamily: mono, letterSpacing: '0.08em', color, background: color + '1a', border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>{children}</span>
}
function Btn({ children, onClick, color = C.green, disabled, small }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ fontFamily: mono, fontSize: small ? 10 : 12, color: disabled ? C.muted : (hov ? C.bg : color), background: disabled ? 'transparent' : (hov ? color : color + '18'), border: `1px solid ${disabled ? C.dim : color + '66'}`, borderRadius: 6, padding: small ? '4px 10px' : '7px 14px', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >{children}</button>
  )
}
function HashBox({ label, value, color = C.purple }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: C.muted, fontSize: 10, fontFamily: mono }}>{label}</span>
        <button onClick={() => { copyToClipboard(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? C.green : C.muted, fontSize: 10, fontFamily: mono, padding: '2px 6px' }}>
          {copied ? '✓ COPIED' : 'COPY'}
        </button>
      </div>
      <div style={{ color, fontSize: 11, fontFamily: mono, wordBreak: 'break-all', background: color + '0e', border: `1px solid ${color}33`, borderRadius: 6, padding: '8px 12px', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

// ============================================================
// Wallet Button — uses @aptos-labs/wallet-adapter-react
// ============================================================
function WalletButton() {
  const { connect, disconnect, connected, connecting, account, wallet, wallets, network } = useWallet()
  const [showMenu, setShowMenu] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)

  const isTestnet = network?.name?.toLowerCase()?.includes('testnet')

  if (connected && account) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{ fontFamily: mono, fontSize: 11, color: C.green, background: C.green + '15', border: `1px solid ${C.green}44`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <GlowDot size={7} />
          {shortAddr(account.address)}
          <span style={{ color: C.muted, fontSize: 9 }}>▼</span>
        </button>
        {showMenu && (
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: C.surface, border: `1px solid ${C.green}22`, borderRadius: 10, padding: 12, minWidth: 240, zIndex: 200, boxShadow: '0 8px 32px #00000088' }}>
            <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, marginBottom: 6, letterSpacing: '0.1em' }}>CONNECTED — {wallet?.name?.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: C.cyan, fontFamily: mono, wordBreak: 'break-all', marginBottom: 4 }}>{toAddrStr(account.address)}</div>
            <div style={{ fontSize: 10, color: isTestnet ? C.green : C.red, fontFamily: mono, marginBottom: 12 }}>
              {isTestnet ? '✓' : '⚠'} Network: {network?.name ?? '—'}
            </div>
            {!isTestnet && (
              <div style={{ fontSize: 10, color: C.amber, fontFamily: mono, background: C.amber + '12', border: `1px solid ${C.amber}33`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                Switch to Aptos Testnet in your wallet
              </div>
            )}
            <button onClick={() => { disconnect(); setShowMenu(false) }}
              style={{ width: '100%', fontFamily: mono, fontSize: 11, color: C.red, background: C.red + '12', border: `1px solid ${C.red}33`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  // Not connected — show wallet picker
  const availableWallets = wallets?.filter(w => w.readyState === 'Installed') ?? []
  const notInstalledWallets = wallets?.filter(w => w.readyState !== 'Installed') ?? []

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowWalletList(!showWalletList)}
        disabled={connecting}
        style={{ fontFamily: mono, fontSize: 11, color: C.amber, background: C.amber + '15', border: `1px solid ${C.amber}44`, borderRadius: 8, padding: '7px 14px', cursor: connecting ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <span style={{ fontSize: 14 }}>◈</span>
        {connecting ? 'Connecting…' : 'Connect Wallet'}
        <span style={{ color: C.muted, fontSize: 9 }}>▼</span>
      </button>

      {showWalletList && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: C.surface, border: `1px solid ${C.amber}22`, borderRadius: 10, padding: 12, minWidth: 220, zIndex: 200, boxShadow: '0 8px 32px #00000088' }}>
          {availableWallets.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, marginBottom: 8, letterSpacing: '0.1em' }}>INSTALLED</div>
              {availableWallets.map(w => (
                <button key={w.name} onClick={() => { connect(w.name); setShowWalletList(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, fontFamily: mono, fontSize: 12, color: '#e0ffe8', background: C.dim, border: `1px solid ${C.green}22`, borderRadius: 7, padding: '8px 12px', cursor: 'pointer', marginBottom: 5 }}>
                  {w.icon && <img src={w.icon} alt={w.name} style={{ width: 20, height: 20, borderRadius: 4 }} />}
                  {w.name}
                  <GlowDot color={C.green} size={6} />
                </button>
              ))}
            </>
          )}
          {notInstalledWallets.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: C.muted, fontFamily: mono, marginBottom: 8, marginTop: availableWallets.length > 0 ? 12 : 0, letterSpacing: '0.1em' }}>NOT INSTALLED</div>
              {notInstalledWallets.map(w => (
                <button key={w.name} onClick={() => window.open(w.url, '_blank')}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, fontFamily: mono, fontSize: 12, color: C.muted, background: 'transparent', border: `1px solid ${C.dim}`, borderRadius: 7, padding: '8px 12px', cursor: 'pointer', marginBottom: 5 }}>
                  {w.icon && <img src={w.icon} alt={w.name} style={{ width: 20, height: 20, borderRadius: 4, opacity: 0.5 }} />}
                  {w.name}
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: C.muted }}>↗ Install</span>
                </button>
              ))}
            </>
          )}
          {availableWallets.length === 0 && notInstalledWallets.length === 0 && (
            <div style={{ fontSize: 11, color: C.muted, fontFamily: mono, padding: '8px 4px' }}>No wallets found</div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Retrieve Modal
// ============================================================
function RetrieveModal({ receipts, onClose }) {
  const [blobIdInput, setBlobIdInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const handleRetrieve = async () => {
    const id = blobIdInput.trim()
    if (!id) return
    setStatus('loading'); setResult(null); setErrMsg('')
    try {
      const data = USE_MOCK
        ? await mockRetrieve(id, receipts)
        : await fetch(`${SHELBY_BASE_URL}/storage/getBlob?blobId=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${SHELBY_SESSION_TOKEN}` },
        }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      setResult(data); setStatus('success')
    } catch (e) { setErrMsg(e.message); setStatus('error') }
  }

  const handleDownload = () => {
    if (!result) return
    const { receipt } = result
    if (receipt._mockFile) {
      const url = URL.createObjectURL(receipt._mockFile)
      const a = document.createElement('a'); a.href = url; a.download = receipt.fileName; a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#000000cc', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceAlt} 100%)`, border: `1px solid ${C.green}30`, borderRadius: 16, padding: 32, width: '100%', maxWidth: 540, boxShadow: `0 0 60px ${C.green}0d` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: '#fff', marginBottom: 4 }}>Retrieve Blob</div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>Enter a Blob ID to fetch + verify from Shelbynet</div>
          </div>
          <button onClick={onClose} style={{ background: C.dim, border: 'none', color: C.muted, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={blobIdInput} onChange={e => setBlobIdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRetrieve()}
            placeholder="shby_XXXXXXXXXXXXXXXXXX"
            style={{ flex: 1, fontFamily: mono, fontSize: 13, background: '#060d0a', border: `1px solid ${C.green}30`, borderRadius: 8, padding: '10px 14px', color: C.green, outline: 'none' }}
          />
          <Btn onClick={handleRetrieve} disabled={status === 'loading' || !blobIdInput.trim()}>{status === 'loading' ? '…' : 'FETCH'}</Btn>
        </div>

        {receipts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: mono, marginBottom: 8, letterSpacing: '0.1em' }}>QUICK SELECT — YOUR BLOBS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 148, overflowY: 'auto' }}>
              {receipts.map(r => (
                <div key={r.blobId} onClick={() => setBlobIdInput(r.blobId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: blobIdInput === r.blobId ? C.green + '14' : C.dim, border: `1px solid ${blobIdInput === r.blobId ? C.green + '44' : 'transparent'}`, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <GlowDot size={6} />
                  <span style={{ flex: 1, fontSize: 12, color: '#e0ffe8', fontFamily: mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</span>
                  <span style={{ fontSize: 10, color: C.muted, fontFamily: mono }}>{formatBytes(r.fileSize)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.cyan, fontSize: 12, fontFamily: mono }}>
            <div className="spin" style={{ fontSize: 26, marginBottom: 10, color: C.cyan }}>◌</div>
            Fetching from Shelbynet…
          </div>
        )}
        {status === 'error' && (
          <div style={{ background: '#ff444411', border: '1px solid #ff444433', borderRadius: 8, padding: '12px 14px', color: C.red, fontSize: 12, fontFamily: mono }}>⚠ {errMsg}</div>
        )}
        {status === 'success' && result && (
          <div style={{ background: C.green + '08', border: `1px solid ${C.green}22`, borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <GlowDot />
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: 15, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.receipt.fileName}</span>
              <Tag color={C.green}>RETRIEVED</Tag>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 16 }}>
              {[['FILE SIZE', formatBytes(result.receipt.fileSize)], ['LATENCY', `${result.latencyMs}ms`], ['SERVED FROM', result.node], ['REGION', result.receipt.region], ['RETRIEVED AT', new Date(result.retrievedAt).toLocaleTimeString()], ['RIGHTS', result.receipt.rights]].map(([l, v]) => (
                <div key={l}><div style={{ color: C.muted, fontSize: 10, fontFamily: mono, marginBottom: 2 }}>{l}</div><div style={{ color: '#e0ffe8', fontSize: 12, fontFamily: mono }}>{v}</div></div>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <HashBox label="RETRIEVE CRYPTOGRAPHIC SIG" value={result.retrieveSig} color={C.amber} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn onClick={handleDownload} color={C.green}>⬇ Download File</Btn>
              <Btn onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${result.receipt.aptosHash}?network=testnet`, '_blank')} color={C.purple} small>↗ Verify on Aptos</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Receipt Card
// ============================================================
function ReceiptCard({ receipt, onRetrieve }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.surface} 0%, ${C.surfaceAlt} 100%)`, border: `1px solid ${C.green}1e`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.green + '55'; e.currentTarget.style.boxShadow = `0 0 24px ${C.green}08` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.green + '1e'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <GlowDot />
        <span style={{ fontFamily: mono, color: C.green, fontSize: 13, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receipt.fileName}</span>
        <Tag color={C.cyan}>{formatBytes(receipt.fileSize)}</Tag>
        <Tag color={C.green}>VERIFIED</Tag>
        <div onClick={e => { e.stopPropagation(); onRetrieve(receipt.blobId) }}><Btn color={C.cyan} small>⬇ Retrieve</Btn></div>
        <span style={{ color: C.muted, fontSize: 15 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <div style={{ padding: '7px 20px', background: C.dim, borderTop: `1px solid ${C.dim}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: C.muted, fontSize: 10, fontFamily: mono }}>BLOB ID</span>
        <span style={{ color: C.cyan, fontSize: 11, fontFamily: mono, flex: 1 }}>{receipt.blobId}</span>
        <button onClick={() => { copyToClipboard(receipt.blobId); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? C.green : C.muted, fontSize: 10, fontFamily: mono }}>
          {copied ? '✓ COPIED' : 'COPY'}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: 20, borderTop: `1px solid ${C.dim}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
            {[['UPLOADED AT', new Date(receipt.uploadedAt).toLocaleString()], ['REGION', receipt.region], ['SERVED FROM', receipt.servedFrom], ['RIGHTS', receipt.rights], ['MIME TYPE', receipt.mimeType]].map(([l, v]) => (
              <div key={l}><div style={{ color: C.muted, fontSize: 10, fontFamily: mono, marginBottom: 2 }}>{l}</div><div style={{ color: '#e0ffe8', fontSize: 12, fontFamily: mono }}>{v}</div></div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <HashBox label="APTOS ONCHAIN HASH" value={receipt.aptosHash} color={C.purple} />
            <HashBox label="CRYPTOGRAPHIC RECEIPT SIG" value={receipt.cryptoSig} color={C.amber} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={() => window.open(`https://explorer.aptoslabs.com/txn/${receipt.aptosHash}?network=testnet`, '_blank')} color={C.purple} small>↗ Aptos Explorer</Btn>
            <div onClick={() => onRetrieve(receipt.blobId)}><Btn color={C.cyan} small>⬇ Retrieve & Download</Btn></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Dashboard (inner — uses useWallet hook)
// ============================================================
function Dashboard() {
  const [receipts, setReceipts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [progress, setProgress] = useState(null)
  const [showRetrieve, setShowRetrieve] = useState(false)
  const fileRef = useRef()

  const { connected, account, network } = useWallet()
  const isTestnet = network?.name?.toLowerCase()?.includes('testnet')

  const handleFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return
    setUploadError(null); setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(`Uploading ${file.name}… (${i + 1}/${files.length})`)
      try {
        const receipt = await mockUpload(file)
        setReceipts(prev => [receipt, ...prev])
      } catch (e) { setUploadError(`"${file.name}": ${e.message}`) }
    }
    setUploading(false); setProgress(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [handleFiles])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: '#e0ffe8', padding: '0 0 80px', backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% 0%, #003d2014 0%, transparent 70%)' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #060d0a; }
        ::-webkit-scrollbar-thumb { background: #00ff8830; border-radius: 4px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.35s ease both; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spin { animation: spin 1s linear infinite; display: inline-block; }
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: `1px solid ${C.green}14`, padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, background: C.bg + 'f0', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={GIPSY_LOGO} alt="Gipsy" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#fff' }}>
              Gipsy <span style={{ color: C.muted, fontWeight: 400, fontSize: 13 }}>by maincore69</span>
            </div>
            <div style={{ fontSize: 9, color: C.cyan, letterSpacing: '0.18em', fontFamily: mono, opacity: 0.7 }}>
              BUILT FOR SHELBY TESTNET
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <GlowDot color={USE_MOCK ? C.amber : C.green} size={7} />
            <span style={{ fontSize: 10, color: C.muted, fontFamily: mono }}>{USE_MOCK ? 'MOCK' : 'TESTNET'}</span>
          </div>
          {receipts.length > 0 && <Tag color={C.cyan}>{receipts.length} BLOBS</Tag>}
          <Btn onClick={() => setShowRetrieve(true)} color={C.cyan} small>⬇ Retrieve Blob</Btn>
          <WalletButton />
        </div>
      </header>

      {/* NETWORK WARNING */}
      {connected && !isTestnet && (
        <div style={{ background: `linear-gradient(90deg, ${C.red}0d, ${C.red}05, ${C.red}0d)`, borderBottom: `1px solid ${C.red}20`, padding: '8px 32px', textAlign: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.red }}>
            ⚠ Wrong network — switch your wallet to <strong>Aptos Testnet</strong>
          </span>
        </div>
      )}

      {/* CONNECT BANNER */}
      {!connected && (
        <div style={{ background: `linear-gradient(90deg, ${C.amber}0d, ${C.amber}05, ${C.amber}0d)`, borderBottom: `1px solid ${C.amber}20`, padding: '10px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 16 }}>◈</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: C.amber }}>
            Connect your wallet (Aptos Testnet) to sign receipts
          </span>
        </div>
      )}

      {/* CONNECTED BANNER */}
      {connected && isTestnet && (
        <div style={{ background: `linear-gradient(90deg, ${C.green}0a, ${C.green}05, ${C.green}0a)`, borderBottom: `1px solid ${C.green}18`, padding: '8px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <GlowDot size={6} />
          <span style={{ fontFamily: mono, fontSize: 10, color: C.green }}>
            Wallet connected · {toAddrStr(account?.address)} · {network?.name}
          </span>
        </div>
      )}

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 0' }}>
        {/* HERO */}
        <div style={{ marginBottom: 48, textAlign: 'center' }} className="fade-up">
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: `1px solid ${C.green}30`, borderRadius: 20, padding: '4px 14px', marginBottom: 18, background: C.green + '0a' }}>
            <GlowDot size={6} />
            <span style={{ fontSize: 10, fontFamily: mono, color: C.green, letterSpacing: '0.12em' }}>SHELBYNET EARLY ACCESS</span>
          </div>
          <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 'clamp(28px, 5vw, 50px)', lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 14 }}>
            Store once.<br />
            <span style={{ background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Verify everywhere.</span>
          </h1>
          <p style={{ color: '#ffffff44', fontSize: 14, lineHeight: 1.75, maxWidth: 460, margin: '0 auto' }}>
            Upload files to Shelby's global namespace. Get cryptographic receipts proven on Aptos — no replication, no regional buckets.
          </p>
        </div>

        {/* UPLOAD ZONE */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? C.green : uploading ? C.cyan + '55' : C.green + '2e'}`, borderRadius: 18, padding: '52px 32px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', transition: 'all 0.2s', marginBottom: 32, background: dragOver ? C.green + '07' : 'transparent', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${C.green}06 1px, transparent 1px), linear-gradient(90deg, ${C.green}06 1px, transparent 1px)`, backgroundSize: '36px 36px' }} />
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(Array.from(e.target.files))} />
          {uploading ? (
            <div>
              <div className="spin" style={{ fontSize: 28, marginBottom: 12, color: C.cyan }}>◌</div>
              <div style={{ color: C.cyan, fontSize: 13, fontFamily: mono }}>{progress}</div>
            </div>
          ) : (
            <div>
              <div style={{ width: 60, height: 60, borderRadius: 16, border: `2px solid ${dragOver ? C.green : C.green + '40'}`, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: dragOver ? C.green : C.green + '66', transition: 'all 0.2s', background: dragOver ? C.green + '12' : 'transparent' }}>{dragOver ? '✦' : '↑'}</div>
              <div style={{ fontSize: 16, color: '#fff', marginBottom: 8, fontFamily: display, fontWeight: 700 }}>Drop files or click to upload</div>
              <div style={{ fontSize: 12, color: '#ffffff25', fontFamily: mono }}>Any file type · Shelby generates a cryptographic receipt per blob</div>
            </div>
          )}
        </div>

        {uploadError && <div style={{ background: '#ff444411', border: '1px solid #ff444433', borderRadius: 8, padding: '11px 16px', marginBottom: 20, color: C.red, fontSize: 12, fontFamily: mono }}>⚠ {uploadError}</div>}

        {/* STATS */}
        {receipts.length > 0 && (
          <div style={{ display: 'flex', gap: 28, marginBottom: 24, borderBottom: `1px solid ${C.dim}`, paddingBottom: 18 }}>
            {[['BLOBS', receipts.length], ['TOTAL SIZE', formatBytes(receipts.reduce((s, r) => s + r.fileSize, 0))], ['VERIFIED ON', 'APTOS'], ['NETWORK', 'SHELBYNET'], ['EGRESS SAVED', '~70%']].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 9, color: '#ffffff25', fontFamily: mono, marginBottom: 3, letterSpacing: '0.1em' }}>{l}</div>
                <div style={{ fontSize: 15, color: C.green, fontWeight: 700, fontFamily: mono }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* BLOB LIST */}
        {receipts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 0', color: '#ffffff18', fontSize: 13, fontFamily: mono }}>
            No blobs yet — upload a file to generate your first verifiable receipt.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {receipts.map((r, i) => (
              <div key={r.blobId} className="fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <ReceiptCard receipt={r} onRetrieve={() => setShowRetrieve(true)} />
              </div>
            ))}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ marginTop: 56, borderTop: `1px solid ${C.dim}`, paddingTop: 22, fontSize: 11, color: '#ffffff1e', textAlign: 'center', lineHeight: 1.9, fontFamily: mono }}>
          {USE_MOCK && (<>⚡ MOCK MODE · receipts are simulated.<br />Replace <code style={{ color: C.amber }}>SHELBY_SESSION_TOKEN</code> in <code style={{ color: C.muted }}>src/App.jsx</code> after getting approved at <a href="https://developers.shelby.xyz" target="_blank" rel="noopener noreferrer" style={{ color: C.cyan }}>developers.shelby.xyz</a><br /><br /></>)}
          Gipsy · built by maincore69 · powered by <a href="https://shelby.xyz" target="_blank" rel="noopener noreferrer" style={{ color: C.green }}>Shelby Protocol</a> + <a href="https://aptoslabs.com" target="_blank" rel="noopener noreferrer" style={{ color: C.purple }}>Aptos</a>
        </div>
      </main>

      {showRetrieve && <RetrieveModal receipts={receipts} onClose={() => setShowRetrieve(false)} />}
    </div>
  )
}

// ============================================================
// Error Boundary — prevents full white screen on wallet errors
// ============================================================
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#060d0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: "'Space Mono', monospace", color: '#ff6b6b', padding: 32 }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontSize: 14 }}>Wallet adapter error</div>
          <div style={{ fontSize: 11, color: '#ffffff33', maxWidth: 400, textAlign: 'center' }}>{this.state.error?.message}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#00ff88', background: '#00ff8815', border: '1px solid #00ff8844', borderRadius: 6, padding: '7px 16px', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================
// Root App — wraps with WalletProvider
// ============================================================
export default function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <Dashboard />
      </WalletProvider>
    </ErrorBoundary>
  )
}
