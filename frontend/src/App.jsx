
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Analytics } from "@vercel/analytics/react";
import {
  Activity, ArrowUpRight, BarChart3, Bell, Bot,
  BrainCircuit, ChevronDown, ChevronRight, CircleHelp,
  Command, Database, FileSpreadsheet, FolderOpen,
  LayoutDashboard, Menu, MessageSquare, MoreHorizontal,
  Plus, Search, Send, Settings, ShieldCheck, Sparkles,
  Upload, X, Zap, TrendingUp, Clock3, FileText, Trash2,
  Building2, Palette, ChartNoAxesCombined, CheckCircle,
  Terminal, Play, Table2
} from "lucide-react";

import alasql from "alasql";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  askAgent,
  checkBackend,
  uploadDataset,
  getDatasetAnalysis,
  analyzeDocument
} from "./services/api";
import "./App.css";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Data Explorer", icon: Database },
  { label: "AI Assistant", icon: Bot },
  { label: "Visualizations", icon: BarChart3 },
  { label: "Reports", icon: FileSpreadsheet },
];

const suggestions = [
  "Explain my dataset",
  "Find missing values",
  "Identify unusual patterns",
  "Recommend a machine learning model",
];

function App() {
  const [page, setPage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState([]);
  const [backend, setBackend] = useState("checking");
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [dataset, setDataset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef(null);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [documentAnalyzing, setDocumentAnalyzing] = useState(false);
  const [documentAnalysisError, setDocumentAnalysisError] = useState("");
  const [savedReports, setSavedReports] = useState(() => {
  try {
    return JSON.parse(
      localStorage.getItem("datamind_saved_reports") || "[]"
    );
  } catch {
    return [];
  }
});

useEffect(() => {
  try {
    localStorage.setItem(
      "datamind_saved_reports",
      JSON.stringify(savedReports)
    );
  } catch (error) {
    console.error("Could not save reports:", error);
  }
}, [savedReports]);

function saveReport(report) {
  if (!report) {
    window.alert("No analysis report is available to save.");
    return null;
  }

  try {
    const currentReports = JSON.parse(
      localStorage.getItem("datamind_saved_reports") || "[]"
    );

    const saved = {
      ...report,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      title: report.filename || "Untitled analysis",
    };

    const updatedReports = [saved, ...currentReports];

    // Save to browser storage immediately.
    localStorage.setItem(
      "datamind_saved_reports",
      JSON.stringify(updatedReports)
    );

    // Update the Reports page.
    setSavedReports(updatedReports);

    return saved;

  } catch (error) {
    console.error("Report saving failed:", error);

    window.alert(
      "Could not save the report. Browser storage may be full or unavailable."
    );

    return null;
  }
}
  useEffect(() => {
    checkBackend()
      .then(() => setBackend("online"))
      .catch(() => setBackend("offline"));
  }, []);
const notifications = [
  ...(file
    ? [{
        id: "upload",
        title: "Dataset selected",
        message: `${file.name} is ready for analysis.`,
        time: "Current session",
        icon: Upload,
      }]
    : []),

  ...(documentAnalysis
    ? [{
        id: "analysis",
        title: "Analysis completed",
        message: `Analysis of ${documentAnalysis.filename || "your file"} is ready.`,
        time: "Current session",
        icon: CheckCircle,
      }]
    : []),

  ...savedReports.slice(0, 5).map((report) => ({
    id: `report-${report.id}`,
    title: "Report saved",
    message: `${report.title || "Untitled report"} was saved.`,
    time: report.savedAt
      ? new Date(report.savedAt).toLocaleString()
      : "Saved report",
    icon: FileText,
  })),
];

const unreadCount = notifications.filter(
  (item) => !readNotifications.includes(item.id)
).length;
function navigate(target) {
  setPage(target);
  setSidebarOpen(false);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function selectFile(event) {
  const selected = event.target.files?.[0];

  if (!selected) return;

  const valid = /\.(csv|xlsx|xls|docx|pptx|pdf|txt|json)$/i.test(
    selected.name
  );

  if (!valid) {
    window.alert("Unsupported file format.");
    event.target.value = "";
    return;
  }

  setFile(selected);
  setDataset(null);
  setAnalysis(null);
  setDocumentAnalysis(null);

  setUploadError("");
  setAnalysisError("");
  setDocumentAnalysisError("");

  setUploading(false);
  setAnalysisLoading(false);
  setDocumentAnalyzing(false);

  navigate("Data Explorer");
  event.target.value = "";
}

  
async function handleDocumentAnalysis() {
  if (!file) return;

  setDocumentAnalyzing(true);
  setDocumentAnalysis(null);
  setDocumentAnalysisError("");

  try {
    console.log("Starting document analysis...");

const result = await analyzeDocument(file);

console.log("Document analysis response:", result);

setDocumentAnalysis(result);
} catch (error) {
  console.error("Document analysis failed:", error);

  setDocumentAnalysisError(
    error.response?.data?.detail ||
    error.message ||
    "Document analysis failed. Please try again."
  );
} finally {
    setDocumentAnalyzing(false);
  }
}
  async function sendMessage(event) {
    event.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    setMessages((old) => [
      ...old,
      { role: "user", content: text },
    ]);

    setQuestion("");
    setLoading(true);

    try {
const datasetContext = documentAnalysis
  ? JSON.stringify({
      filename: documentAnalysis.filename,
      file_type: documentAnalysis.file_type,
      analysis_type: documentAnalysis.analysis_type,
      analysis: documentAnalysis.analysis,
      insights: documentAnalysis.insights,
      recommendations: documentAnalysis.recommendations,
      resume_analysis: documentAnalysis.resume_analysis,
      text_metrics: documentAnalysis.text_metrics,
      extracted_text: documentAnalysis.extracted_text_preview
    }).slice(0, 10000)

  : dataset
    ? JSON.stringify({
        filename: dataset.filename,
        rows: dataset.rows,
        columns: dataset.columns,
        column_names: dataset.column_names,
        missing_values: dataset.missing_values,
        duplicates: dataset.duplicates,
        preview: dataset.preview,
        statistical_analysis: analysis
      }).slice(0, 10000)

    : null;

const result = await askAgent(text, datasetContext);

      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content: result.answer || "No response received.",
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          content:
            error.response?.data?.detail ||
            "Unable to reach the AI service. Check that your backend is running.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function askSuggested(text) {
    setPage("AI Assistant");
    setQuestion(text);
  }

  return (
    <>
      <Analytics />
      <div className="app-shell">

      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={23} />
          </div>
          <div className="brand-copy">
            <strong>DataMind<span>.</span></strong>
            <small>INTELLIGENCE STUDIO</small>
          </div>
          <button
            className="mobile-close icon-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-select">
          <div className="workspace-avatar">DS</div>
          <div className="workspace-copy">
            <strong>My Workspace</strong>
            <small>Personal account</small>
          </div>
          <ChevronDown size={16} />
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => navigate(label)}
              className={`nav-link ${page === label ? "selected" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {page === label && <span className="active-indicator" />}
            </button>
          ))}
        </nav>

<div className="sidebar-divider" />

<div className="nav-label tools-label">TOOLS</div>

<button
  className={`nav-link ${page === "Data Explorer" ? "selected" : ""}`}
  onClick={() => navigate("Data Explorer")}
>
  <FolderOpen size={18} />
  <span>My Datasets</span>
</button>

<button
  className={`nav-link ${page === "Data Quality" ? "selected" : ""}`}
  onClick={() => navigate("Data Quality")}
>
  <ShieldCheck size={18} />
  <span>Data Quality</span>
</button>

<button
  className={`nav-link ${page === "Data Cleaning" ? "selected" : ""}`}
  onClick={() => navigate("Data Cleaning")}
>
  <Sparkles size={18} />
  <span>Data Cleaning</span>
</button>

<button
  className={`nav-link ${page === "Correlation Lab" ? "selected" : ""}`}
  onClick={() => navigate("Correlation Lab")}
>
  <Activity size={18} />
  <span>Correlation Lab</span>
</button>

<button
  className={`nav-link ${page === "Export Centre" ? "selected" : ""}`}
  onClick={() => navigate("Export Centre")}
>
  <FileSpreadsheet size={18} />
  <span>Export Centre</span>
</button>

<button
  className={`nav-link ${page === "Data Dictionary" ? "selected" : ""}`}
  onClick={() => navigate("Data Dictionary")}
>
  <FileText size={18} />
  <span>Data Dictionary</span>
</button>

<button
  className={`nav-link ${page === "SQL Query Lab" ? "selected" : ""}`}
  onClick={() => navigate("SQL Query Lab")}
>
  <Command size={18} />
  <span>SQL Query Lab</span>
</button>

<button
  className={`nav-link ${page === "Model Studio" ? "selected" : ""}`}
  onClick={() => navigate("Model Studio")}
>
  <BrainCircuit size={18} />
  <span>Model Studio</span>
</button>

<div className="sidebar-spacer" />

<div className="sidebar-divider" />

<button
  className={`nav-link ${page === "Settings" ? "selected" : ""}`}
  onClick={() => navigate("Settings")}
>
  <Settings size={18} />
  <span>Settings</span>
</button>

</aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle icon-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
          </div>

          <div className="topbar-right">
<div className="notification-wrapper">
  <button
    className="icon-button notification-button"
    aria-label="Notifications"
    aria-expanded={notificationOpen}
    onClick={() => setNotificationOpen((old) => !old)}
  >
    <Bell size={19} />
    {unreadCount > 0 && <i />}
  </button>

  {notificationOpen && (
    <div className="notification-panel">
      <div className="notification-header">
        <div>
          <h3>Notifications</h3>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "You're all caught up"}
          </p>
        </div>

        <button
          className="notification-close"
          onClick={() => setNotificationOpen(false)}
          aria-label="Close notifications"
        >
          <X size={17} />
        </button>
      </div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <div className="notification-empty-icon">
              <Bell size={24} />
            </div>
            <strong>No notifications yet</strong>
            <p>
              Updates about your datasets, analyses and reports
              will appear here.
            </p>
          </div>
        ) : (
          notifications.map((item) => {
            const Icon = item.icon;
            const isRead = readNotifications.includes(item.id);

            return (
              <div
                className={`notification-item ${isRead ? "is-read" : ""}`}
                key={item.id}
              >
                <div className="notification-item-icon">
                  <Icon size={18} />
                </div>

                <div className="notification-item-content">
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <small>{item.time}</small>
                </div>

                {!isRead && (
                  <button
                    className="notification-read-button"
                    onClick={() =>
                      setReadNotifications((old) => [...old, item.id])
                    }
                    title="Mark as read"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {notifications.length > 0 && unreadCount > 0 && (
        <button
          className="notification-mark-all"
          onClick={() =>
            setReadNotifications(notifications.map((item) => item.id))
          }
        >
          Mark all as read
        </button>
      )}
    </div>
  )}
</div>

<button
  className="auth-login-button"
  onClick={() => navigate("Login")}
>
  Log in
</button>

<button
  className="auth-signup-button"
  onClick={() => navigate("Sign Up")}
>
  Get Started <ArrowUpRight size={15} />
</button>
</div>

        </header>

        <div className="content-area">
{page === "Login" && (
  <AuthPage mode="login" navigate={navigate} />
)}

{page === "Sign Up" && (
  <AuthPage mode="signup" navigate={navigate} />
)}
          {page === "Overview" && (
            <Dashboard
              file={file}
              fileInput={fileInput}
              selectFile={selectFile}
              askSuggested={askSuggested}
              navigate={navigate}
            />
          )}

          {page === "Data Explorer" && (
            <DataExplorer
              file={file}
              fileInput={fileInput}
              selectFile={selectFile}
              dataset={dataset}
              uploading={uploading}
              uploadError={uploadError}
              analysis={analysis}
              analysisLoading={analysisLoading}
              analysisError={analysisError}
              documentAnalysis={documentAnalysis}
              documentAnalyzing={documentAnalyzing}
documentAnalysisError={documentAnalysisError}
handleDocumentAnalysis={handleDocumentAnalysis}
onSaveReport={saveReport}
savedReports={savedReports}
/>
          )}

          {page === "AI Assistant" && (
            <Assistant
              messages={messages}
              question={question}
              setQuestion={setQuestion}
              sendMessage={sendMessage}
              loading={loading}
              askSuggested={askSuggested}
            />
          )}

{page === "Visualizations" && (
  <VisualizationStudio
    documentAnalysis={documentAnalysis}
    file={file}
    navigate={navigate}
  />
)}

{page === "Reports" && (
  <ReportsCentre
    reports={savedReports}
    setReports={setSavedReports}
    navigate={navigate}
  />
)}


{page === "Data Quality" && (
  <DataQualityTool report={documentAnalysis} />
)}

{page === "Data Cleaning" && (
  <DataCleaningTool report={documentAnalysis} />
)}

{page === "Correlation Lab" && (
  <CorrelationLab report={documentAnalysis} />
)}

{page === "Export Centre" && (
  <ExportCentre reports={savedReports} />
)}
{page === "Data Dictionary" && (
  <DataDictionary report={documentAnalysis} />
)}
{page === "SQL Query Lab" && (
  <SQLQueryLab file={file} />
          )}
{page === "Model Studio" && (
  <ModelStudio report={documentAnalysis} />
          )}
          
{page === "Settings" && (
  <SettingsPanel />
)}
        </div>
      </main>
    </div>
    </>
  );
}
function AuthPage({ mode, navigate }) {
  const isSignup = mode === "signup";

  function handleSubmit(event) {
    event.preventDefault();

    window.alert(
      "The authentication interface is ready, but account authentication has not been connected to the backend yet."
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-decoration">
        <div className="auth-brand">
          <div className="brand-mark">
            <BrainCircuit size={25} />
          </div>
          <strong>DataMind<span>.</span></strong>
        </div>

        <div className="auth-promo">
          <span className="eyebrow">YOUR AI DATA SCIENTIST</span>
          <h1>
            Turn your data
            <br />
            into <span>decisions.</span>
          </h1>
          <p>
            Analyze datasets, discover patterns, and generate
            meaningful insights with your intelligent workspace.
          </p>

          <div className="auth-feature">
            <ShieldCheck size={18} />
            Intelligent data analysis
          </div>
          <div className="auth-feature">
            <BarChart3 size={18} />
            Interactive visualizations
          </div>
          <div className="auth-feature">
            <Sparkles size={18} />
            AI-powered insights
          </div>
        </div>

        <small className="auth-footer">
          DATA INTELLIGENCE STUDIO
        </small>
      </div>

      <div className="auth-form-area">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <BrainCircuit size={25} />
            <strong>DataMind<span>.</span></strong>
          </div>

          <span className="eyebrow">
            {isSignup ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}
          </span>

          <h2>
            {isSignup ? "Get started" : "Welcome back"}
          </h2>

          <p className="auth-subtitle">
            {isSignup
              ? "Create your account and start exploring your data."
              : "Log in to continue to your DataMind workspace."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </label>

            {isSignup && (
              <label>
                Confirm password
                <input
                  type="password"
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            )}

            {!isSignup && (
              <div className="auth-options">
                <label className="remember-option">
                  <input type="checkbox" />
                  Remember me
                </label>
                <span>Forgot password?</span>
              </div>
            )}

            <button className="auth-submit-button" type="submit">
              {isSignup ? "Create account" : "Log in"}
              <ArrowUpRight size={17} />
            </button>
          </form>

          <div className="auth-switch">
            {isSignup
              ? "Already have an account?"
              : "Don't have an account?"}

            <button
              type="button"
              onClick={() => navigate(isSignup ? "Login" : "Sign Up")}
            >
              {isSignup ? "Log in" : "Sign up"}
            </button>
          </div>

          <button
            className="auth-back-button"
            onClick={() => navigate("Overview")}
          >
            ← Back to workspace
          </button>
        </div>
      </div>
    </div>
  );
}
function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({ file, fileInput, selectFile, askSuggested, navigate }) {
  return (
    <div className="dashboard">
      <PageHeading
        eyebrow="YOUR DATA INTELLIGENCE WORKSPACE"
        title="Good to have you here."
        description="Your data has a story. Let's discover what it tells us."
        action={
          <button className="primary-button" onClick={() => navigate("Data Explorer")}>
            <Plus size={17} /> New analysis
          </button>
        }
      />

      <section className="hero-banner">
        <div className="hero-content">
          <div className="hero-tag">
            <Sparkles size={14} /> INTELLIGENCE, REIMAGINED
          </div>
          <h2>From raw data<br />to <span>real insights.</span></h2>
          <p>
            Upload your datasets, ask questions in plain language,
            and uncover insights with your AI data scientist.
          </p>
          <button className="hero-button" onClick={() => navigate("AI Assistant")}>
            Explore AI Assistant <ArrowUpRight size={17} />
          </button>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-core">
            <BrainCircuit size={48} />
          </div>
          <div className="floating-node node-one"><BarChart3 size={19} /></div>
          <div className="floating-node node-two"><Database size={18} /></div>
          <div className="floating-node node-three"><Sparkles size={17} /></div>
        </div>
        <div className="hero-decoration">DM</div>
      </section>

      <div className="section-title">
        <div>
          <h2>Workspace overview</h2>
          <p>Your analytics at a glance</p>
        </div>
        <span className="updated-label"><Clock3 size={13} /> Just getting started</span>
      </div>

      <section className="metrics-grid">
        <Metric icon={Database} label="Datasets" value="0" note="Ready for your first upload" />
        <Metric icon={BrainCircuit} label="AI analyses" value="0" note="Your insights start here" />
        <Metric icon={BarChart3} label="Visualizations" value="0" note="Charts will appear here" />
        <Metric icon={FileSpreadsheet} label="Reports created" value="0" note="No reports yet" />
      </section>

      <section className="dashboard-grid">
        <div className="surface upload-card">
          <div className="surface-heading">
            <div>
              <h3>Start with your data</h3>
              <p>Bring a dataset into your workspace.</p>
            </div>
            <div className="heading-icon"><Upload size={19} /></div>
          </div>

          <button className="dropzone" onClick={() => fileInput.current?.click()}>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls,.docx,.pptx,.pdf,.txt,.json"
              hidden
              onChange={selectFile}
            />
            <div className="upload-symbol"><Upload size={24} /></div>
            <strong>{file ? file.name : "Upload your dataset"}</strong>
            <span>{file ? "Selected — ready for processing integration" : "Choose a CSV or Excel file from your computer"}</span>
            <small>CSV · XLSX · XLS</small>
          </button>

          <div className="upload-footnote">
            <ShieldCheck size={15} /> Your dataset is selected locally. Secure upload is the next integration step.
          </div>
        </div>

        <div className="surface quick-card">
          <div className="surface-heading">
            <div>
              <h3>Ask your AI scientist</h3>
              <p>What would you like to explore?</p>
            </div>
            <div className="heading-icon"><Bot size={19} /></div>
          </div>

          <div className="quick-list">
            {[
              { icon: Search, title: "Explore a dataset", desc: "Understand structure and patterns", prompt: "How do I explore a new dataset using Python?" },
              { icon: Activity, title: "Check data quality", desc: "Find missing values and duplicates", prompt: "How do I check missing values and duplicates in Pandas?" },
              { icon: BrainCircuit, title: "Build a model", desc: "Choose the right machine learning approach", prompt: "How should I choose a machine learning model for a dataset?" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button className="quick-row" key={item.title} onClick={() => askSuggested(item.prompt)}>
                  <div className="quick-icon"><Icon size={18} /></div>
                  <div className="quick-copy">
                    <strong>{item.title}</strong>
                    <span>{item.desc}</span>
                  </div>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="surface activity-card">
        <div className="surface-heading">
          <div>
            <h3>Recent activity</h3>
            <p>Your latest workspace actions</p>
          </div>
          <span className="muted-label">ACTIVITY</span>
        </div>
        <div className="empty-activity">
          <div className="activity-icon"><Clock3 size={20} /></div>
          <div>
            <strong>Your workspace is ready</strong>
            <p>Upload a dataset or start a conversation to see activity here.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div className="metric-icon"><Icon size={19} /></div>
        <span className="metric-menu"><MoreHorizontal size={18} /></span>
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function DataExplorer({
  file,
  fileInput,
  selectFile,
  dataset,
  uploading,
  uploadError,
  analysis,
  analysisLoading,
  analysisError,
  documentAnalysis,
  documentAnalyzing,
  documentAnalysisError,
  handleDocumentAnalysis,
  onSaveReport,
  savedReports = [],
}) {
  const [selectedSheet, setSelectedSheet] = useState("");

  return (
    <div className="inner-page">
      <PageHeading
        eyebrow="DATA MANAGEMENT"
        title="Data Explorer"
        description="Upload and prepare datasets for intelligent analysis."
      />

      <div className="surface explorer-surface">
        <div className="explorer-illustration"><Database size={34} /></div>
        <h2>
{documentAnalyzing
  ? "Analyzing your file..."
  : documentAnalysis
    ? "Analysis completed"
    : file
      ? "Your file is ready for analysis"
      : "Bring your data into focus."}
        </h2>
        {uploadError && (
  <p style={{ color: "red" }}>{uploadError}</p>
)}Upload Dataset
        <button className="primary-button" onClick={() => fileInput.current?.click()}>
          <Upload size={17} /> Select dataset
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xls,.docx,.pptx,.pdf,.txt,.json"
          hidden
          onChange={selectFile}
        />

        {file && (
          <div className="selected-file">
            <FileSpreadsheet size={20} />
            <div>
              <strong>{file.name}</strong>
              <small>{(file.size / 1024).toFixed(1)} KB · Selected locally</small>
            </div>
          </div>
        )}
        {file && (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "20px",
    gap: "12px"
  }}>
    <button
      className="primary-button"
      onClick={handleDocumentAnalysis}
      disabled={!file || documentAnalyzing}
    >
      {documentAnalyzing
        ? "Analyzing your file..."
        : "✦ Generate Analysis Report"}
    </button>

    {documentAnalysisError && (
      <p style={{ color: "red" }}>
        {documentAnalysisError}
      </p>
    )}
  </div>
        )}
{documentAnalysis && (() => {
  const report = documentAnalysis;
  const analysis = report.analysis || {};
  const resume = report.resume_analysis;
  const isDataset = report.analysis_type === "dataset";
  const isResume = report.analysis_type === "resume";

const sheets = analysis.sheets || {};
const sheetNames = Object.keys(sheets);

const activeSheetName = sheetNames.includes(selectedSheet)
  ? selectedSheet
  : sheetNames[0];

const dataset = activeSheetName
  ? sheets[activeSheetName]
  : analysis;

  const kpis = isDataset
    ? [
        { label: "Rows", value: dataset.rows ?? "—" },
        { label: "Columns", value: dataset.columns ?? "—" },
        { label: "Missing values", value: dataset.missing_values ?? "—" },
        { label: "Duplicate rows", value: dataset.duplicate_rows ?? "—" },
      ]
    : isResume
    ? [
        { label: "Detected skills", value: resume?.skills_total ?? 0 },
        { label: "Projects detected", value: resume?.project_count ?? 0 },
        { label: "Certifications detected", value: resume?.certification_count ?? 0 },
        { label: "Words extracted", value: resume?.word_count ?? 0 },
      ]
    : [
        { label: "Words", value: report.text_metrics?.word_count ?? 0 },
        { label: "Characters", value: report.text_metrics?.character_count ?? 0 },
        { label: "Lines", value: report.text_metrics?.line_count ?? 0 },
        { label: "Pages / slides", value: analysis.page_count ?? analysis.slide_count ?? "—" },
      ];

  const profiles = dataset.column_profiles || [];
  const correlations = dataset.correlation_matrix || {};
  const outliers = dataset.outlier_counts || {};
  const statistics = dataset.numeric_statistics || {};
  
const distributions = dataset.numeric_distributions || {};
const missingByColumn = dataset.missing_by_column || {};

const categoricalProfiles = profiles.filter(
  (profile) => profile.top_values?.length > 0
);

const maxMissing = Math.max(
  1,
  ...Object.values(missingByColumn)
);
        

  const cardStyle = {
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(20,70,65,0.12)",
    borderRadius: "14px",
    padding: "18px",
    minWidth: 0,
  };

  const sectionStyle = {
    background: "rgba(255,255,255,0.48)",
    border: "1px solid rgba(20,70,65,0.12)",
    borderRadius: "16px",
    padding: "22px",
    marginTop: "20px",
  };

  return (
    <div className="surface" style={{
      marginTop: "24px",
      padding: "28px",
      borderRadius: "20px",
      textAlign: "left",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div>
          <h2 style={{ margin: 0 }}>DataMind Analysis Report</h2>
          <p style={{ marginBottom: 0, opacity: 0.7 }}>
            {report.filename}
          </p>
        </div>

        <span style={{
          padding: "7px 12px",
          borderRadius: "20px",
          background: "#d9eee8",
          color: "#205b4e",
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "uppercase",
        }}>
          {report.analysis_type || "document"} analysis
        </span>
      </div>
<div style={{
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 16
}}>
  <button
    className="primary-button"
    onClick={() => {
  const saved = onSaveReport?.(report);

  if (saved) {
    window.alert("Report saved successfully!");
  } else {
    window.alert("Report could not be saved. Check the error message.");
  }
}}
  >
    <FileSpreadsheet size={16} />
    Save report
  </button>
      </div>
      
{/* Excel worksheet navigation */}
{isDataset && sheetNames.length > 1 && (
  <div style={{
    marginTop: "26px",
    padding: "20px",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(20,70,65,0.12)",
    borderRadius: "16px",
  }}>
    <h3 style={{ marginTop: 0 }}>
      Explore workbook
    </h3>

    <p style={{ opacity: 0.7, fontSize: "13px" }}>
      This workbook contains {sheetNames.length} worksheets.
      Select one to explore its data.
    </p>

    <select
      value={activeSheetName || ""}
      onChange={(event) => setSelectedSheet(event.target.value)}
      style={{
        width: "100%",
        maxWidth: "420px",
        padding: "13px",
        borderRadius: "10px",
        border: "1px solid #a9c9c2",
        background: "#ffffff",
        color: "#123c35",
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      {sheetNames.map((sheetName) => (
        <option key={sheetName} value={sheetName}>
          {sheetName}
        </option>
      ))}
    </select>

    <p style={{
      marginBottom: 0,
      marginTop: "12px",
      fontSize: "13px",
      color: "#52756e",
    }}>
      Currently exploring: <strong>{activeSheetName}</strong>
    </p>
  </div>
)}

      {/* KPI cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "14px",
        marginTop: "24px",
      }}>
        {kpis.map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ fontSize: "13px", opacity: 0.7 }}>
              {item.label}
            </div>
            <div style={{
              fontSize: "27px",
              fontWeight: 750,
              marginTop: "8px",
              overflowWrap: "anywhere",
            }}>
              {typeof item.value === "number"
                ? item.value.toLocaleString()
                : item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Dataset column profiles */}
      {isDataset && profiles.length > 0 && (
        <div style={sectionStyle}>
          <h3>Column profiling</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "600px",
            }}>
              <thead>
                <tr>
                  {["Column", "Type", "Unique", "Missing", "Mean", "Minimum", "Maximum"].map((heading) => (
                    <th key={heading} style={{
                      textAlign: "left",
                      padding: "12px",
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                    }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.column}>
                    {[
                      profile.column,
                      profile.data_type,
                      profile.unique_values,
                      `${profile.missing_percentage ?? 0}%`,
                      profile.mean ?? "—",
                      profile.minimum ?? "—",
                      profile.maximum ?? "—",
                    ].map((value, index) => (
                      <td key={index} style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(0,0,0,0.07)",
                      }}>
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

{/* VISUAL ANALYTICS */}
<div style={{
  marginTop: "28px",
  padding: "24px",
  borderRadius: "20px",
  background: "rgba(255,255,255,0.38)",
  border: "1px solid rgba(20,70,65,0.12)",
}}>
  <div style={{ marginBottom: "22px" }}>
    <span style={{
      fontSize: "11px",
      letterSpacing: "2px",
      color: "#398573",
      fontWeight: 700,
    }}>
      DATA VISUALIZATION
    </span>
    <h2 style={{ margin: "7px 0" }}>Understand your data visually</h2>
    <p style={{ margin: 0, opacity: 0.7 }}>
      Charts generated from the selected worksheet.
    </p>
  </div>

  {/* Numeric distributions */}
  {Object.keys(distributions).length > 0 && (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "16px",
    }}>
      {Object.entries(distributions).map(([column, bins]) => {
        const maxCount = Math.max(
          1,
          ...bins.map((bin) => bin.count)
        );

        return (
          <div key={column} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>{column}</h3>
            <p style={{ fontSize: "12px", opacity: 0.65 }}>
              Value distribution · Frequency
            </p>

            <div style={{
              height: "170px",
              display: "flex",
              alignItems: "end",
              gap: "5px",
              paddingTop: "15px",
            }}>
              {bins.map((bin, index) => (
                <div
                  key={index}
                  title={`${bin.range}: ${bin.count} records`}
                  style={{
                    flex: 1,
                    height: `${Math.max(3, bin.count / maxCount * 100)}%`,
                    background: "linear-gradient(180deg,#54b69a,#237763)",
                    borderRadius: "5px 5px 0 0",
                    minWidth: 0,
                  }}
                />
              ))}
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              opacity: 0.65,
              marginTop: "9px",
            }}>
              <span>{bins[0]?.range}</span>
              <span>{bins[bins.length - 1]?.range}</span>
            </div>
          </div>
        );
      })}
    </div>
  )}

  {/* Missing value chart */}
  {Object.keys(missingByColumn).length > 0 && (
    <div style={{ ...cardStyle, marginTop: "16px" }}>
      <h3 style={{ marginTop: 0 }}>Missing values by column</h3>
      <p style={{ fontSize: "12px", opacity: 0.65 }}>
        Number of empty cells in each column.
      </p>

      {Object.entries(missingByColumn).map(([column, count]) => (
        <div key={column} style={{ marginTop: "14px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            fontSize: "13px",
            marginBottom: "6px",
          }}>
            <span>{column}</span>
            <strong>{count.toLocaleString()}</strong>
          </div>

          <div style={{
            height: "9px",
            borderRadius: "20px",
            background: "#e3ece9",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${count / maxMissing * 100}%`,
              height: "100%",
              background: count > 0 ? "#d58a55" : "#54a88d",
              borderRadius: "20px",
            }} />
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Categorical distributions */}
  {categoricalProfiles.length > 0 && (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "16px",
      marginTop: "16px",
    }}>
      {categoricalProfiles.map((profile) => {
        const maxCount = Math.max(
          1,
          ...profile.top_values.map((item) => item.count)
        );

        return (
          <div key={profile.column} style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>
              {profile.column}
            </h3>
            <p style={{ fontSize: "12px", opacity: 0.65 }}>
              Top 5 most frequent values
            </p>

            {profile.top_values.map((item, index) => (
              <div key={`${item.value}-${index}`} style={{
                marginTop: "13px",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  fontSize: "13px",
                  marginBottom: "5px",
                }}>
                  <span style={{
                    overflowWrap: "anywhere",
                  }}>
                    {item.value}
                  </span>
                  <strong>{item.count}</strong>
                </div>

                <div style={{
                  height: "8px",
                  background: "#e3ece9",
                  borderRadius: "20px",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${item.count / maxCount * 100}%`,
                    height: "100%",
                    background: "#638dc1",
                    borderRadius: "20px",
                  }} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  )}

  {Object.keys(distributions).length === 0 &&
    Object.keys(missingByColumn).length === 0 &&
    categoricalProfiles.length === 0 && (
      <p>No chartable data was found in this worksheet.</p>
    )}
</div>

      {/* Numeric statistics */}
      {isDataset && Object.keys(statistics).length > 0 && (
        <div style={sectionStyle}>
          <h3>Statistical analysis</h3>
          {Object.entries(statistics).map(([metric, values]) => (
            <div key={metric} style={{ marginTop: "18px" }}>
              <h4 style={{ marginBottom: "8px" }}>{metric}</h4>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: "10px",
              }}>
                {Object.entries(values).map(([stat, value]) => (
                  <div key={stat} style={cardStyle}>
                    <div style={{ fontSize: "12px", opacity: 0.7 }}>
                      {stat}
                    </div>
                    <strong>
  {typeof value === "number"
    ? value.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })
    : value ?? "—"}
</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outlier analysis */}
      {isDataset && Object.keys(outliers).length > 0 && (
        <div style={sectionStyle}>
          <h3>Potential outliers</h3>
          {Object.entries(outliers).map(([column, count]) => (
            <div key={column} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}>
              <span>{column}</span>
              <strong>{count}</strong>
            </div>
          ))}
          <p style={{ fontSize: "12px", opacity: 0.65 }}>
            Detected using the 1.5 × IQR rule. Outliers require contextual review.
          </p>
        </div>
      )}

      {/* Correlations */}
      {isDataset && Object.keys(correlations).length > 0 && (
        <div style={sectionStyle}>
          <h3>Correlation matrix</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px", textAlign: "left" }}>Column</th>
                  {Object.keys(correlations).map((column) => (
                    <th key={column} style={{ padding: "10px" }}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(correlations).map(([row, values]) => (
                  <tr key={row}>
                    <th style={{ padding: "10px", textAlign: "left" }}>{row}</th>
                    {Object.keys(correlations).map((column) => (
                      <td key={column} style={{
                        padding: "10px",
                        textAlign: "center",
                        background: values[column] == null
                          ? "transparent"
                          : `rgba(32, 120, 95, ${Math.min(Math.abs(values[column]), 1) * 0.35})`,
                      }}>
                        {values[column] == null
                          ? "—"
                          : Number(values[column]).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "12px", opacity: 0.65 }}>
            Correlation measures linear association, not causation.
          </p>
        </div>
      )}

      {/* Resume skills */}
      {isResume && resume && (
        <div style={sectionStyle}>
          <h3>Detected skills</h3>
          {Object.entries(resume.skills_by_category || {}).map(([category, skills]) => (
            <div key={category} style={{ marginTop: "16px" }}>
              <strong>{category}</strong>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "8px",
              }}>
                {skills.length > 0
                  ? skills.map((skill) => (
                      <span key={skill} style={{
                        background: "#d9eee8",
                        padding: "7px 11px",
                        borderRadius: "20px",
                        fontSize: "13px",
                      }}>
                        {skill}
                      </span>
                    ))
                  : <span style={{ opacity: 0.6 }}>No skills detected</span>}
              </div>
            </div>
          ))}

          <h3 style={{ marginTop: "24px" }}>Section detection</h3>
          {Object.entries(resume.sections_detected || {}).map(([section, found]) => (
            <div key={section} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "9px 0",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
            }}>
              <span style={{ textTransform: "capitalize" }}>{section}</span>
              <strong>{found ? "Detected" : "Not detected"}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Python-generated findings */}
      {(report.insights || []).length > 0 && (
        <div style={sectionStyle}>
          <h3>DataMind findings</h3>
          <ul style={{ lineHeight: 1.8, paddingLeft: "20px" }}>
            {report.insights.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {(report.recommendations || []).length > 0 && (
        <div style={sectionStyle}>
          <h3>Recommendations</h3>
          <ul style={{ lineHeight: 1.8, paddingLeft: "20px" }}>
            {report.recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}


{/* DataMind Intelligence Brief */}
<div className="ai-report-panel">

  <div className="ai-report-header">
    <div>
      <span className="ai-report-eyebrow">
        DATAMIND INTELLIGENCE
      </span>
      <h2>Analysis & Insights</h2>
      <p>
        An intelligent interpretation of your uploaded file.
      </p>
    </div>

    <div className="ai-report-status">
      <span className="status-dot" />
{report.ai_status === "available"
  ? "Analysis generated"
  : report.ai_status === "quota_exceeded"
  ? "AI daily quota reached"
  : "AI temporarily unavailable"}
    </div>
  </div>

  {report.ai_summary ? (
    <div className="ai-report-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {report.ai_summary}
      </ReactMarkdown>
    </div>
  ) : (
    <div className="ai-report-empty">
      <Sparkles size={25} />
      <h3>No AI interpretation available</h3>
      <p>
        Your extracted data and Python-generated findings
        are still available above.
      </p>
    </div>
  )}

  <div className="ai-report-footer">
    <Sparkles size={15} />
    <span>Generated by DataMind Intelligence</span>
  </div>

</div>


      {/* Extracted text preview */}
      {report.extracted_text_preview && (
        <details style={sectionStyle}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            View extracted text
          </summary>
          <pre style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            lineHeight: 1.6,
            fontFamily: "inherit",
            marginTop: "16px",
          }}>
            {report.extracted_text_preview}
          </pre>
        </details>
      )}
    </div>
  );  
        })()}
        
{analysis && (
  <p>Calculating statistical analysis...</p>
)}

{analysisError && (
  <p style={{ color: "red" }}>{analysisError}</p>
)}

{analysis && (
  <div className="surface" style={{ marginTop: "24px", padding: "24px" }}>
    <h2>Statistical analysis</h2>

    <h3>Missing values by column</h3>

    {Object.entries(analysis.missing_by_column).map(([column, count]) => (
      <p key={column}>
        <strong>{column}:</strong> {count}
      </p>
    ))}

    <h3 style={{ marginTop: "24px" }}>Numeric statistics</h3>

    {Object.keys(analysis.numeric_statistics).length === 0 ? (
      <p>No numeric columns were detected.</p>
    ) : (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Column</th>
              <th>Mean</th>
              <th>Median</th>
              <th>Minimum</th>
              <th>Maximum</th>
              <th>Std. deviation</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(analysis.numeric_statistics).map(
              ([column, stats]) => (
                <tr key={column}>
                  <td>{column}</td>
                  <td>{stats.mean ?? "N/A"}</td>
                  <td>{stats.median ?? "N/A"}</td>
                  <td>{stats.minimum ?? "N/A"}</td>
                  <td>{stats.maximum ?? "N/A"}</td>
                  <td>{stats.std ?? "N/A"}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
        <div className="file-support">
  SUPPORTED FORMATS · CSV · XLSX · XLS · PDF · DOCX · PPTX · JSON · TXT
</div>
        {dataset && (
  <div className="surface" style={{ marginTop: "24px", padding: "24px" }}>
    <h2>Dataset overview</h2>

    <div className="metrics-grid">
      <Metric
        icon={Database}
        label="Total rows"
        value={dataset.rows}
        note="Records uploaded"
      />

      <Metric
        icon={BarChart3}
        label="Total columns"
        value={dataset.columns}
        note="Features detected"
      />

      <Metric
        icon={Activity}
        label="Missing values"
        value={dataset.missing_values}
        note="Empty cells detected"
      />

      <Metric
        icon={ShieldCheck}
        label="Duplicates"
        value={dataset.duplicates}
        note="Duplicate rows detected"
      />
    </div>

    <h3 style={{ marginTop: "28px" }}>Column names</h3>

    <p>{dataset.column_names.join(", ")}</p>

    <h3 style={{ marginTop: "28px" }}>Data preview</h3>

    {dataset.preview.length > 0 ? (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {dataset.column_names.map((column) => (
                <th
                  key={column}
                  style={{ padding: "12px", textAlign: "left" }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {dataset.preview.map((row, index) => (
              <tr key={index}>
                {dataset.column_names.map((column) => (
                  <td key={column} style={{ padding: "12px" }}>
                    {String(row[column] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p>No preview data available.</p>
    )}
  </div>
)}
      </div>
    </div>
  );
}


function Assistant({
  messages,
  question,
  setQuestion,
  sendMessage,
  loading,
  askSuggested
}) {
  const commands = [
    {
      icon: Database,
      title: "Dataset intelligence",
      description: "Explore structure, metrics and patterns",
      prompt: "Analyze my dataset and explain its key findings."
    },
    {
      icon: ShieldCheck,
      title: "Data quality scan",
      description: "Inspect missing values and duplicates",
      prompt: "Perform a data quality assessment."
    },
    {
      icon: Activity,
      title: "Anomaly detection",
      description: "Identify unusual values and patterns",
      prompt: "Identify unusual patterns and potential anomalies."
    },
    {
      icon: BrainCircuit,
      title: "ML recommendations",
      description: "Find suitable machine learning approaches",
      prompt: "Recommend suitable machine learning models for my data."
    }
  ];

  return (
    <div className="assistant-page jarvis-page">

      {/* SYSTEM HEADER */}
      <div className="jarvis-header">
        <div className="jarvis-identity">
          <div className="jarvis-logo">
            <BrainCircuit size={25} />
            <span className="jarvis-logo-pulse" />
          </div>

          <div>
            <div className="jarvis-overline">DATAMIND INTELLIGENCE SYSTEM</div>
            <h2>DATA MIND <span>AI</span></h2>
            <p>Autonomous Data Science Interface</p>
          </div>
        </div>

        <div className="jarvis-system-status">
          <span className="jarvis-live-dot" />
          SYSTEM ONLINE
        </div>
      </div>

      {/* MAIN DISPLAY */}
      <div className="jarvis-main">

        {messages.length === 0 ? (
          <div className="jarvis-welcome">

            <div className="jarvis-core">
              <div className="jarvis-ring ring-one" />
              <div className="jarvis-ring ring-two" />
              <div className="jarvis-ring ring-three" />
              <div className="jarvis-core-center">
                <BrainCircuit size={43} />
              </div>
              <span className="core-node node-top" />
              <span className="core-node node-bottom" />
              <span className="core-node node-left" />
              <span className="core-node node-right" />
            </div>

            <div className="jarvis-overline">
              ARTIFICIAL INTELLIGENCE / DATA SCIENCE
            </div>

            <h1>
              Intelligence at your
              <span> command.</span>
            </h1>

            <p className="jarvis-description">
              Your personal analytical intelligence system.
              Ask questions, investigate datasets and discover
              meaningful insights.
            </p>

            <div className="jarvis-command-label">
              <span />
              AVAILABLE ANALYTICAL MODULES
            </div>

            <div className="jarvis-command-grid">
              {commands.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    className="jarvis-command"
                    key={item.title}
                    onClick={() => askSuggested(item.prompt)}
                  >
                    <div className="jarvis-command-icon">
                      <Icon size={19} />
                    </div>

                    <div className="jarvis-command-copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>

                    <ArrowUpRight size={16} />
                  </button>
                );
              })}
            </div>

            <div className="jarvis-footer-stats">
              <div>
                <span className="jarvis-live-dot" />
                AI ENGINE READY
              </div>
              <div>DATA ANALYSIS MODULE</div>
              <div>INTERACTIVE MODE</div>
            </div>

          </div>
        ) : (
          <div className="jarvis-conversation">

            <div className="jarvis-conversation-heading">
              <div>
                <div className="jarvis-overline">ACTIVE SESSION</div>
                <h3>Intelligence Console</h3>
              </div>
              <span className="jarvis-session-status">
                <span className="jarvis-live-dot" />
                LIVE
              </span>
            </div>

            {messages.map((message, index) => (
              <div
                className={`jarvis-message ${message.role}`}
                key={index}
              >
                <div className="jarvis-message-icon">
                  {message.role === "user"
                    ? "AJ"
                    : <BrainCircuit size={19} />}
                </div>

                <div className="jarvis-message-content">
                  <strong>
                    {message.role === "user"
                      ? "YOU"
                      : "DATAMIND INTELLIGENCE"}
                  </strong>

                  <div className="jarvis-message-text">
                    {message.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="jarvis-thinking">
                <span />
                <span />
                <span />
                PROCESSING REQUEST...
              </div>
            )}
          </div>
        )}

      </div>

      {/* COMMAND INPUT */}
      <form className="jarvis-composer" onSubmit={sendMessage}>

        <div className="jarvis-composer-heading">
          <span><Command size={13} /> COMMAND INPUT</span>
          <span>SECURE SESSION</span>
        </div>

        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask DataMind anything. Enter a command or analytical question..."
          rows={2}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }}
        />

        <div className="jarvis-composer-footer">
          <span>ENTER TO EXECUTE · SHIFT + ENTER FOR NEW LINE</span>

          <button
            type="submit"
            disabled={!question.trim() || loading}
          >
            <Send size={15} />
            EXECUTE
          </button>
        </div>
      </form>

      <div className="jarvis-disclaimer">
        DATAMIND AI · ANALYTICAL OUTPUT SHOULD BE VERIFIED
      </div>

    </div>
  );
}


function VisualizationStudio({ documentAnalysis, file, navigate }) {
  const report = documentAnalysis;
  const analysis = report?.analysis || {};
  const sheets = analysis.sheets || {};
  const sheetNames = Object.keys(sheets);

  const [selectedSheet, setSelectedSheet] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [chartType, setChartType] = useState("bar");

  const activeSheetName = sheetNames.includes(selectedSheet)
    ? selectedSheet
    : sheetNames[0];

  const activeSheet = activeSheetName
    ? sheets[activeSheetName]
    : analysis;

  const preview = Array.isArray(activeSheet?.preview)
    ? activeSheet.preview
    : Array.isArray(analysis.preview)
      ? analysis.preview
      : [];

  const detectedColumns = preview.length
    ? Object.keys(preview[0]).filter((key) =>
        preview.some((row) =>
          row[key] !== null &&
          row[key] !== "" &&
          Number.isFinite(Number(row[key]))
        )
      )
    : [];

  const numericColumns =
    activeSheet?.numeric_columns?.length
      ? activeSheet.numeric_columns
      : detectedColumns;

  const column = numericColumns.includes(selectedColumn)
    ? selectedColumn
    : numericColumns[0];

  const chartData = column
    ? preview
        .map((row, index) => ({
          label: String(index + 1),
          value: Number(row[column]),
        }))
        .filter((item) => Number.isFinite(item.value))
    : [];

  const values = chartData.map((item) => item.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  const rows = activeSheet?.rows ?? analysis.rows ?? 0;
  const columns = activeSheet?.columns ?? analysis.columns ?? 0;
  const missing = activeSheet?.missing_values ?? analysis.missing_values ?? 0;
  const duplicates = activeSheet?.duplicate_rows ?? analysis.duplicate_rows ?? 0;

  return (
    <div className="inner-page visualization-page">
      <PageHeading
        eyebrow="DATA INTELLIGENCE"
        title="Visualization Studio"
        description="Explore your dataset through charts and statistical summaries."
        action={
          <button
            className="primary-button"
            onClick={() => navigate("Data Explorer")}
          >
            <Plus size={16} /> New analysis
          </button>
        }
      />

      {!report ? (
        <div className="surface visualization-empty">
          <div className="explorer-illustration">
            <BarChart3 size={32} />
          </div>
          <h2>Your visual workspace is ready.</h2>
          <p>Upload and analyze a CSV or Excel dataset to generate charts.</p>
          <button
            className="primary-button"
            onClick={() => navigate("Data Explorer")}
          >
            <Upload size={16} /> Upload dataset
          </button>
        </div>
      ) : report.analysis_type !== "dataset" ? (
        <div className="surface visualization-empty">
          <FileText size={32} />
          <h2>No dataset charts available.</h2>
          <p>Upload a CSV or Excel dataset to generate statistical charts.</p>
        </div>
      ) : (
        <>
          {sheetNames.length > 1 && (
            <div className="viz-toolbar">
              <label>
                Worksheet
                <select
                  value={activeSheetName || ""}
                  onChange={(event) => setSelectedSheet(event.target.value)}
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="viz-kpi-grid">
            <div className="viz-kpi">
              <span>Total rows</span>
              <strong>{Number(rows).toLocaleString()}</strong>
              <small>Dataset records</small>
            </div>
            <div className="viz-kpi">
              <span>Total columns</span>
              <strong>{columns}</strong>
              <small>Available fields</small>
            </div>
            <div className="viz-kpi">
              <span>Missing values</span>
              <strong>{Number(missing).toLocaleString()}</strong>
              <small>Requires review</small>
            </div>
            <div className="viz-kpi">
              <span>Duplicate rows</span>
              <strong>{Number(duplicates).toLocaleString()}</strong>
              <small>Detected duplicates</small>
            </div>
          </div>

          <div className="viz-grid">
            <section className="surface viz-chart-card">
              <div className="viz-card-heading">
                <div>
                  <h3>Custom chart builder</h3>
                  <p>Choose a numeric field and chart type.</p>
                </div>
                <BarChart3 size={21} />
              </div>

              {numericColumns.length > 0 && (
                <div className="viz-controls">
                  <label>
                    Numeric column
                    <select
                      value={column || ""}
                      onChange={(event) => setSelectedColumn(event.target.value)}
                    >
                      {numericColumns.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Chart type
                    <select
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value)}
                    >
                      <option value="bar">Bar chart</option>
                      <option value="line">Line chart</option>
                    </select>
                  </label>
                </div>
              )}

              {chartData.length > 0 ? (
                <>
                  <div className="viz-chart">
                    <div className="viz-chart-meta">
                      <strong>{column}</strong>
                      <span>{chartData.length} preview values</span>
                    </div>

                    <svg
                      viewBox="0 0 640 260"
                      role="img"
                      aria-label={`${chartType} chart for ${column}`}
                    >
                      {[50, 100, 150, 200].map((y) => (
                        <line
                          key={y}
                          x1="45"
                          y1={y}
                          x2="620"
                          y2={y}
                          stroke="#d9e8e2"
                          strokeDasharray="4 5"
                        />
                      ))}

                      {chartType === "bar" ? (
                        chartData.map((item, index) => {
                          const barWidth = Math.max(
                            8,
                            520 / chartData.length - 8
                          );
                          const height = max === 0
                            ? 2
                            : Math.max(2, (item.value / max) * 175);
                          const x = 55 + index * (520 / chartData.length);

                          return (
                            <rect
                              key={index}
                              x={x}
                              y={210 - height}
                              width={barWidth}
                              height={height}
                              rx="5"
                              fill="#39977d"
                            >
                              <title>{`Row ${item.label}: ${item.value}`}</title>
                            </rect>
                          );
                        })
                      ) : (
                        <polyline
                          points={chartData.map((item, index) => {
                            const x = 55 + index * (
                              520 / Math.max(chartData.length - 1, 1)
                            );
                            const y = max === 0
                              ? 210
                              : 210 - (item.value / max) * 175;
                            return `${x},${y}`;
                          }).join(" ")}
                          fill="none"
                          stroke="#39977d"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>

                    <div className="viz-chart-note">
                      Based on extracted preview rows, not necessarily the entire dataset.
                    </div>
                  </div>

                  <div className="viz-summary">
                    <div><span>Minimum</span><strong>{min.toLocaleString()}</strong></div>
                    <div><span>Maximum</span><strong>{max.toLocaleString()}</strong></div>
                    <div><span>Average</span><strong>{average.toFixed(2)}</strong></div>
                  </div>
                </>
              ) : (
                <div className="viz-no-data">
                  No numeric preview data is available for chart generation.
                </div>
              )}
            </section>

            <section className="surface viz-insights-card">
              <div className="viz-card-heading">
                <div>
                  <h3>Analysis overview</h3>
                  <p>Findings from your analysis pipeline.</p>
                </div>
                <Sparkles size={21} />
              </div>

              <div className="viz-insight-list">
                {(report.insights || []).length > 0 ? (
                  report.insights.map((item, index) => (
                    <div className="viz-insight" key={index}>
                      <span><TrendingUp size={16} /></span>
                      <p>{item}</p>
                    </div>
                  ))
                ) : (
                  <p>No additional findings are available.</p>
                )}
              </div>

              <div className="viz-recommendations">
                <strong>Recommendations</strong>
                {(report.recommendations || []).length > 0 ? (
                  <ul>
                    {report.recommendations.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No recommendations are available.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div className="inner-page">
      <PageHeading eyebrow="WORKSPACE" title={title} description={description} />
      <div className="surface coming-soon">
        <div className="explorer-illustration"><Icon size={33} /></div>
        <h2>Something insightful is coming.</h2>
        <p>{description}</p>
        <span className="coming-label"><Sparkles size={13} /> UNDER DEVELOPMENT</span>
      </div>
    </div>
  );
}

function ReportsCentre({ reports, setReports, navigate }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  const selectedReport = reports.find(
    (item) => item.id === selectedId
  );

  const filteredReports = reports.filter((report) => {
    const text = `${report.title || ""} ${report.filename || ""} ${report.analysis_type || ""}`.toLowerCase();

    return (
      text.includes(query.toLowerCase()) &&
      (typeFilter === "all" || report.analysis_type === typeFilter)
    );
  });

const [renameTarget, setRenameTarget] = useState(null);
const [renameValue, setRenameValue] = useState("");

function renameReport(report) {
  setRenameTarget(report);
  setRenameValue(report.title || report.filename || "");
}

function saveRename() {
  const newName = renameValue.trim();

  if (!newName) {
    window.alert("Please enter a report name.");
    return;
  }

  setReports((items) =>
    items.map((item) =>
      item.id === renameTarget.id
        ? { ...item, title: newName }
        : item
    )
  );

  setRenameTarget(null);
  setRenameValue("");
}
const [deleteTarget, setDeleteTarget] = useState(null);

function deleteReport(report) {
  setDeleteTarget(report);
}

function confirmDeleteReport() {
  if (!deleteTarget) return;

  setReports((items) =>
    items.filter((item) => item.id !== deleteTarget.id)
  );

  if (selectedId === deleteTarget.id) {
    setSelectedId(null);
  }

  setDeleteTarget(null);
}

  function exportJson(report) {
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "datamind-report.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportPdf(report) {
    const escapeHtml = (value) =>
      String(value ?? "").replace(/[&<>"']/g, (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]
      );

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>DataMind Report</title>
        <style>
          body {
            font: 14px/1.7 Arial;
            color: #173d37;
            padding: 35px;
          }
          h1 { color: #073b32; }
          h2 {
            margin-top: 25px;
            border-bottom: 1px solid #ddd;
          }
          pre { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>DataMind Analysis Report</h1>
        <h2>${escapeHtml(report.title)}</h2>
        <p>${escapeHtml(report.filename)}</p>

        <h2>AI Interpretation</h2>
        <pre>${escapeHtml(report.ai_summary || "No AI summary available.")}</pre>

        <h2>Findings</h2>
        <ul>
          ${(report.insights || []).map((item) =>
            `<li>${escapeHtml(item)}</li>`
          ).join("")}
        </ul>

        <h2>Recommendations</h2>
        <ul>
          ${(report.recommendations || []).map((item) =>
            `<li>${escapeHtml(item)}</li>`
          ).join("")}
        </ul>

        <h2>Analysis Data</h2>
        <pre>${escapeHtml(JSON.stringify(report.analysis || {}, null, 2))}</pre>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");

    if (!win) {
      window.alert("Allow pop-ups to export PDF.");
      return;
    }

    win.document.write(html);
    win.document.close();

    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  return (
    <div className="inner-page">
      <PageHeading
        eyebrow="WORKSPACE / KNOWLEDGE BASE"
        title="Report Centre"
        description="Manage and export your saved DataMind analyses."
        action={
          <button
            className="primary-button"
            onClick={() => navigate("Data Explorer")}
          >
            <Plus size={16} /> New analysis
          </button>
        }
      />

      <div className="viz-kpi-grid">
        <div className="viz-kpi">
          <span>Total reports</span>
          <strong>{reports.length}</strong>
          <small>Saved reports</small>
        </div>

        <div className="viz-kpi">
          <span>Dataset reports</span>
          <strong>
            {reports.filter((r) => r.analysis_type === "dataset").length}
          </strong>
          <small>Dataset analyses</small>
        </div>

        <div className="viz-kpi">
          <span>Document reports</span>
          <strong>
            {reports.filter((r) => r.analysis_type !== "dataset").length}
          </strong>
          <small>Document analyses</small>
        </div>

        <div className="viz-kpi">
          <span>Latest saved</span>
          <strong style={{ fontSize: 17 }}>
            {reports[0]
              ? new Date(reports[0].savedAt).toLocaleDateString()
              : "—"}
          </strong>
          <small>Most recent report</small>
        </div>
      </div>

      <section className="surface" style={{
        padding: 22,
        borderRadius: 18,
        marginTop: 22
      }}>
        <h2>Your reports</h2>

        <div style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 20
        }}>
<input
  className="report-search-input"
  type="search"
  placeholder="Search your reports..."
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  style={{
    width: "260px",
    maxWidth: "100%",
    padding: "12px 15px",
    border: "1px solid #a9c9c2",
    borderRadius: "10px",
    background: "#fffaf0",
    color: "#073b32",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box"
  }}
/>

<select
  value={typeFilter}
  onChange={(e) => setTypeFilter(e.target.value)}
  style={{
    minWidth: "180px",
    padding: "12px 15px",
    border: "1px solid #a9c9c2",
    borderRadius: "10px",
    background: "#fffaf0",
    color: "#073b32",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none"
  }}
>
  <option value="all">All report types</option>
  <option value="dataset">Dataset</option>
  <option value="resume">Resume</option>
  <option value="document">Document</option>
</select>
        </div>

        {selectedReport && (
          <div className="viz-insights-card" style={{ padding: 20 }}>
            <h2>{selectedReport.title}</h2>

            <h3>AI Interpretation</h3>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedReport.ai_summary || "No AI interpretation available."}
            </ReactMarkdown>

            <h3>Findings</h3>
            <ul>
              {(selectedReport.insights || []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <h3>Recommendations</h3>
            <ul>
              {(selectedReport.recommendations || []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>

            <button
              className="primary-button"
              onClick={() => exportPdf(selectedReport)}
            >
              Export PDF
            </button>

            <button
              className="secondary-button"
              onClick={() => exportJson(selectedReport)}
            >
              Export JSON
            </button>

            <button
              className="secondary-button"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
        )}

        {filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <article
              key={report.id}
              style={{
                border: "1px solid #c9ddd6",
                borderRadius: 13,
                padding: 16,
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap"
              }}
            >
              <div>
                <strong>{report.title || report.filename}</strong>
                <p style={{ fontSize: 12, opacity: 0.7 }}>
                  {report.analysis_type} · {report.filename}
                </p>
                <small>
                  {new Date(report.savedAt).toLocaleString()}
                </small>
              </div>

<div className="report-actions">
                <button
                  className="secondary-button"
                  onClick={() => setSelectedId(report.id)}
                >
                  View
                </button>

                <button
                  className="secondary-button"
                  onClick={() => renameReport(report)}
                >
                  Rename
                </button>

                <button
                  className="secondary-button"
                  onClick={() => exportPdf(report)}
                >
                  PDF
                </button>

                <button
                  className="secondary-button"
                  onClick={() => deleteReport(report)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="visualization-empty">
            <FileSpreadsheet size={32} />
            <h2>No reports found</h2>
            <p>
              Generate an analysis in Data Explorer and save it here.
            </p>
          </div>
        )}
      </section>

{renameTarget && (
  <div
    onClick={() => setRenameTarget(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(3, 35, 29, 0.55)",
      backdropFilter: "blur(5px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: 440,
        background: "#fff0d8",
        border: "1px solid #d8c9a7",
        borderRadius: 20,
        padding: 28,
        boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
        textAlign: "left",
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      }}>
        <div>
          <span style={{
            color: "#478b7c",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
          }}>
            REPORT MANAGEMENT
          </span>

          <h2 style={{
            margin: "7px 0 0",
            color: "#073b32",
            fontSize: 23,
          }}>
            Rename report
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setRenameTarget(null)}
          aria-label="Close rename dialog"
          style={{
            border: 0,
            background: "#dcebe5",
            color: "#073b32",
            borderRadius: 10,
            width: 36,
            height: 36,
            cursor: "pointer",
            fontSize: 20,
          }}
        >
          ×
        </button>
      </div>

      <p style={{
        color: "#637c74",
        fontSize: 13,
        marginBottom: 18,
      }}>
        Give this report a clear, meaningful name.
      </p>

      <label style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: "#174c40",
        marginBottom: 8,
      }}>
        Report name
      </label>

      <input
        autoFocus
        value={renameValue}
        onChange={(event) => setRenameValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") saveRename();
          if (event.key === "Escape") setRenameTarget(null);
        }}
        placeholder="Enter report name"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 15px",
          border: "1px solid #b5cec3",
          borderRadius: 11,
          outline: "none",
          background: "#ffffff",
          color: "#073b32",
          fontSize: 14,
          marginBottom: 24,
        }}
      />

      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
      }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setRenameTarget(null)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={saveRename}
        >
          Save changes
        </button>
      </div>
    </div>
  </div>
)}

      <p style={{ fontSize: 12, opacity: 0.65, marginTop: 12 }}>
        Reports are currently stored in this browser only.
      </p>

{deleteTarget && (
  <div
    onClick={() => setDeleteTarget(null)}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "rgba(3, 35, 29, 0.58)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}
  >
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        width: "100%",
        maxWidth: 420,
        background: "#fff0d8",
        border: "1px solid #dfc9aa",
        borderRadius: 20,
        padding: 28,
        boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
        textAlign: "left",
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        background: "#f8dfd7",
        color: "#b84d3d",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 23,
        marginBottom: 18,
      }}>
        <Trash2 size={23} />
      </div>

      <h2 style={{
        color: "#073b32",
        fontSize: 22,
        margin: "0 0 10px",
      }}>
        Delete this report?
      </h2>

      <p style={{
        color: "#637c74",
        fontSize: 13,
        lineHeight: 1.7,
        marginBottom: 24,
      }}>
        Are you sure you want to delete
        <strong style={{ color: "#174c40" }}>
          {" "}{deleteTarget.title || deleteTarget.filename}
        </strong>?
        This action cannot be undone.
      </p>

      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
      }}>
        <button
          className="secondary-button"
          onClick={() => setDeleteTarget(null)}
        >
          Cancel
        </button>

        <button
          onClick={confirmDeleteReport}
          style={{
            border: "1px solid #b84d3d",
            borderRadius: 9,
            padding: "10px 17px",
            background: "#b84d3d",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Trash2 size={14} />
          {" "}Delete report
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

function DataDictionary({ report }) {
  const data = getToolAnalysis(report);
  const profiles = data.column_profiles || [];
  const preview = data.preview || [];

  const [search, setSearch] = useState("");

  const columns = profiles.length
    ? profiles
    : preview.length
      ? Object.keys(preview[0]).map((column) => ({
          column,
          column_type: "Unknown",
        }))
      : [];

  const filteredColumns = columns.filter((item) =>
    String(item.column || item.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inner-page">
      <ToolPageHeader
        title="Data Dictionary"
        description="Understand your dataset's structure, fields and data types."
        icon={FileText}
      />

      {!report ? (
        <div className="surface visualization-empty">
          <Database size={35} />
          <h2>No dataset available</h2>
          <p>
            Upload and analyze a dataset in Data Explorer to
            automatically generate its data dictionary.
          </p>
        </div>
      ) : (
        <>
          <div className="viz-kpi-grid">
            <div className="viz-kpi">
              <span>Total columns</span>
              <strong>{data.columns || columns.length}</strong>
              <small>Detected fields</small>
            </div>

            <div className="viz-kpi">
              <span>Total records</span>
              <strong>{Number(data.rows || 0).toLocaleString()}</strong>
              <small>Dataset rows</small>
            </div>

            <div className="viz-kpi">
              <span>Numeric fields</span>
              <strong>
                {columns.filter((item) =>
                  /numeric|number|integer|float/i.test(
                    item.column_type || item.dtype || ""
                  )
                ).length}
              </strong>
              <small>Numerical columns</small>
            </div>

            <div className="viz-kpi">
              <span>Missing values</span>
              <strong>{Number(data.missing_values || 0).toLocaleString()}</strong>
              <small>Across the dataset</small>
            </div>
          </div>

          <section className="surface" style={{ padding: 24 }}>
            <div className="viz-card-heading">
              <div>
                <h3>Column definitions</h3>
                <p>Explore the detected fields in your dataset.</p>
              </div>
              <FileText size={22} />
            </div>

            <div style={{ margin: "20px 0" }}>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search columns..."
                style={{
                  width: "100%",
                  maxWidth: 380,
                  padding: "12px 15px",
                  border: "1px solid #dce5de",
                  borderRadius: 9,
                  fontSize: 13,
                }}
              />
            </div>

            {filteredColumns.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table className="data-dictionary-table">
                  <thead>
                    <tr>
                      <th>Column name</th>
                      <th>Data type</th>
                      <th>Missing values</th>
                      <th>Description</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredColumns.map((item, index) => {
                      const name = item.column || item.name;
                      const missing =
                        data.missing_by_column?.[name] ?? "—";

                      return (
                        <tr key={name || index}>
                          <td><strong>{name}</strong></td>
                          <td>
                            <span className="dictionary-type">
                              {item.column_type || item.dtype || "Unknown"}
                            </span>
                          </td>
                          <td>{missing}</td>
                          <td>
                            {item.description ||
                              item.inferred_type ||
                              "No description available"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="viz-no-data">
                {columns.length === 0
                  ? "No column metadata was returned by the analysis."
                  : "No columns match your search."}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SQLQueryLab({ file }) {
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [query, setQuery] = useState(
    "SELECT * FROM datamind_data LIMIT 20;"
  );
  const [results, setResults] = useState([]);
  const [resultColumns, setResultColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [executed, setExecuted] = useState(false);
  const [tableName, setTableName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      setRows([]);
      setColumns([]);
      setResults([]);
      setResultColumns([]);
      setError("");
      setExecuted(false);
      setTableName("");

      if (!file) return;

      setLoading(true);

      try {
        const extension = file.name.split(".").pop().toLowerCase();
        let records = [];

        if (extension === "csv") {
          records = await new Promise((resolve, reject) => {
            Papa.parse(file, {
              header: true,
              dynamicTyping: true,
              skipEmptyLines: true,
              complete: (result) => {
                if (result.errors.length) {
                  reject(new Error(result.errors[0].message));
                } else {
                  resolve(result.data);
                }
              },
              error: reject,
            });
          });
        } else if (["xlsx", "xls"].includes(extension)) {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];

          records = XLSX.utils.sheet_to_json(sheet, {
            defval: null,
          });
        } else {
          throw new Error(
            "SQL Query Lab currently supports CSV and Excel files only."
          );
        }

        if (!records.length) {
          throw new Error("The selected file contains no data rows.");
        }

        const detectedColumns = Object.keys(records[0]);

        if (!detectedColumns.length) {
          throw new Error("No column headers were detected.");
        }

        if (!cancelled) {
          setRows(records);
          setColumns(detectedColumns);
          setTableName(file.name);
          setQuery("SELECT * FROM datamind_data LIMIT 20;");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not read the dataset.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDataset();

    return () => {
      cancelled = true;
    };
  }, [file]);

  function executeQuery() {
    setError("");
    setExecuted(false);
    setResults([]);
    setResultColumns([]);

    if (!rows.length) {
      setError("Upload a CSV or Excel dataset first.");
      return;
    }

    const normalizedQuery = query.trim();

    // Read-only protection: only one SELECT statement is accepted.
    if (
      !/^SELECT\b/i.test(normalizedQuery) ||
      /;\s*\S/.test(normalizedQuery) ||
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|ATTACH|DETACH)\b/i.test(
        normalizedQuery
      )
    ) {
      setError(
        "Only a single read-only SELECT statement is allowed."
      );
      return;
    }

    try {
      const table = "datamind_data";

      // Rebuild the temporary in-memory SQL table.
      try {
        alasql(`DROP TABLE IF EXISTS ${table}`);
      } catch {}

      const schema = columns
        .map((column) => {
          const safeName = String(column).replace(/`/g, "``");
          return `\`${safeName}\` STRING`;
        })
        .join(", ");

      alasql(`CREATE TABLE ${table} (${schema})`);

      alasql.tables[table].data = rows;

      const output = alasql(normalizedQuery);

      if (!Array.isArray(output)) {
        throw new Error("The query did not return a result set.");
      }

      const outputColumns = output.length
        ? Object.keys(output[0])
        : [];

      setResults(output);
      setResultColumns(outputColumns);
      setExecuted(true);
    } catch (err) {
      setError(err.message || "SQL execution failed.");
    }
  }

  function useExample(example) {
    setQuery(example);
    setError("");
  }

  const examples = [
    {
      label: "View records",
      sql: "SELECT * FROM datamind_data LIMIT 20;",
    },
    {
      label: "Count records",
      sql: "SELECT COUNT(*) AS total_records FROM datamind_data;",
    },
    {
      label: "Find unique values",
      sql: columns.length
        ? `SELECT DISTINCT \`${columns[0]}\` FROM datamind_data LIMIT 50;`
        : "SELECT DISTINCT column_name FROM datamind_data;",
    },
    {
      label: "Sort records",
      sql: columns.length
        ? `SELECT * FROM datamind_data ORDER BY \`${columns[0]}\` DESC LIMIT 20;`
        : "SELECT * FROM datamind_data ORDER BY column_name DESC LIMIT 20;",
    },
  ];

  return (
    <div className="inner-page sql-page">
      <PageHeading
        eyebrow="DATAMIND / QUERY ENGINE"
        title="SQL Query Lab"
        description="Explore your datasets using SQL and inspect query results."
      />

      <div className="sql-status-bar">
        <div className="sql-status">
          <span className={`sql-status-dot ${rows.length ? "online" : ""}`} />
          {loading
            ? "Loading dataset..."
            : rows.length
              ? "Dataset loaded"
              : "Waiting for dataset"}
        </div>

        <span className="sql-table-name">
          {tableName || "No dataset selected"}
        </span>
      </div>

      {!file ? (
        <div className="surface visualization-empty">
          <Database size={35} />
          <h2>No dataset selected</h2>
          <p>
            Upload a CSV or Excel file in Data Explorer before
            running SQL queries.
          </p>
        </div>
      ) : (
        <>
          <div className="sql-metrics">
            <div className="viz-kpi">
              <span>Available records</span>
              <strong>{rows.length.toLocaleString()}</strong>
              <small>Loaded into browser memory</small>
            </div>

            <div className="viz-kpi">
              <span>Columns</span>
              <strong>{columns.length}</strong>
              <small>Detected fields</small>
            </div>

            <div className="viz-kpi">
              <span>Returned rows</span>
              <strong>{results.length.toLocaleString()}</strong>
              <small>Latest query result</small>
            </div>
          </div>

          <div className="sql-layout">
            <section className="surface sql-editor-card">
              <div className="sql-card-heading">
                <div>
                  <h3>
                    <Terminal size={18} />
                    Query editor
                  </h3>
                  <p>Write a SQL SELECT statement.</p>
                </div>

                <span className="sql-language-badge">SQL</span>
              </div>

              <textarea
                className="sql-editor"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                spellCheck={false}
                placeholder="SELECT * FROM datamind_data LIMIT 20;"
                rows={9}
              />

              <div className="sql-editor-footer">
                <span>Table: datamind_data</span>

                <button
                  className="sql-run-button"
                  onClick={executeQuery}
                  disabled={loading || !rows.length}
                >
                  <Play size={15} fill="currentColor" />
                  Run query
                </button>
              </div>

              {error && (
                <div className="sql-error">
                  <strong>Query error</strong>
                  <p>{error}</p>
                </div>
              )}

              <div className="sql-examples">
                <h4>Example queries</h4>

                <div className="sql-example-list">
                  {examples.map((example) => (
                    <button
                      key={example.label}
                      onClick={() => useExample(example.sql)}
                    >
                      {example.label}
                      <span>↗</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="surface sql-schema-card">
              <div className="sql-card-heading">
                <div>
                  <h3>
                    <Table2 size={18} />
                    Schema explorer
                  </h3>
                  <p>Available columns in your dataset.</p>
                </div>
              </div>

              <div className="sql-schema-table">
                <div className="sql-schema-row schema-heading">
                  <span>Column</span>
                  <span>Detected type</span>
                </div>

                {columns.map((column, index) => {
                  const value = rows[0]?.[column];

                  const type =
                    value === null || value === undefined
                      ? "Unknown"
                      : typeof value === "number"
                        ? "Number"
                        : value instanceof Date
                          ? "Date"
                          : "Text";

                  return (
                    <div className="sql-schema-row" key={index}>
                      <strong>{column}</strong>
                      <span>{type}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="surface sql-results-card">
            <div className="sql-card-heading">
              <div>
                <h3>Query results</h3>
                <p>
                  {executed
                    ? `${results.length.toLocaleString()} rows returned`
                    : "Execute a query to display results."}
                </p>
              </div>
              <Table2 size={20} />
            </div>

            {executed && results.length > 0 ? (
              <div className="sql-results-table">
                <table>
                  <thead>
                    <tr>
                      {resultColumns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {results.slice(0, 500).map((row, index) => (
                      <tr key={index}>
                        {resultColumns.map((column) => (
                          <td key={column}>
                            {row[column] === null ||
                            row[column] === undefined
                              ? "NULL"
                              : String(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : executed ? (
              <div className="viz-no-data">
                Query executed successfully. No rows were returned.
              </div>
            ) : (
              <div className="sql-results-empty">
                <Table2 size={28} />
                <p>Your query results will appear here.</p>
              </div>
            )}

            {results.length > 500 && (
              <p className="sql-result-note">
                Showing the first 500 of {results.length} returned rows.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ModelStudio({ report }) {
  const data = getToolAnalysis(report);
  const preview = Array.isArray(data.preview) ? data.preview : [];

  const numericColumns = preview.length
    ? Object.keys(preview[0]).filter((column) => {
        const values = preview
          .map((row) => Number(row[column]))
          .filter(Number.isFinite);

        return values.length >= 3 &&
          values.length / preview.length >= 0.7;
      })
    : [];

  const [feature, setFeature] = useState("");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const selectedFeature = numericColumns.includes(feature)
    ? feature
    : numericColumns.find((column) => column !== target) || "";

  const selectedTarget = numericColumns.includes(target)
    ? target
    : numericColumns.find((column) => column !== selectedFeature) || "";

  function trainModel() {
    setError("");
    setResult(null);

    if (!preview.length) {
      setError("No dataset preview is available. Analyze a dataset first.");
      return;
    }

    if (
      !selectedFeature ||
      !selectedTarget ||
      selectedFeature === selectedTarget
    ) {
      setError("Select two different numeric columns.");
      return;
    }

    const records = preview
      .map((row) => ({
        x: Number(row[selectedFeature]),
        y: Number(row[selectedTarget]),
      }))
      .filter(
        (row) => Number.isFinite(row.x) && Number.isFinite(row.y)
      );

    if (records.length < 10) {
      setError("At least 10 valid numeric records are required.");
      return;
    }

    // Use every fifth record for testing.
    const training = records.filter((_, index) => index % 5 !== 0);
    const testing = records.filter((_, index) => index % 5 === 0);

    if (training.length < 2 || testing.length < 2) {
      setError("Not enough records for a training and test split.");
      return;
    }

    const meanX =
      training.reduce((sum, row) => sum + row.x, 0) / training.length;

    const meanY =
      training.reduce((sum, row) => sum + row.y, 0) / training.length;

    const denominator = training.reduce(
      (sum, row) => sum + (row.x - meanX) ** 2,
      0
    );

    if (denominator === 0) {
      setError("The predictor column has no variation.");
      return;
    }

    const slope =
      training.reduce(
        (sum, row) => sum + (row.x - meanX) * (row.y - meanY),
        0
      ) / denominator;

    const intercept = meanY - slope * meanX;

    const predictions = testing.map((row) => ({
      actual: row.y,
      predicted: intercept + slope * row.x,
    }));

    const errors = predictions.map(
      (row) => row.actual - row.predicted
    );

    const mae =
      errors.reduce((sum, value) => sum + Math.abs(value), 0) /
      errors.length;

    const rmse = Math.sqrt(
      errors.reduce((sum, value) => sum + value ** 2, 0) /
      errors.length
    );

    const testMean =
      predictions.reduce((sum, row) => sum + row.actual, 0) /
      predictions.length;

    const totalVariance = predictions.reduce(
      (sum, row) => sum + (row.actual - testMean) ** 2,
      0
    );

    const residualVariance = errors.reduce(
      (sum, value) => sum + value ** 2,
      0
    );

    const r2 =
      totalVariance === 0
        ? null
        : 1 - residualVariance / totalVariance;

    setResult({
      slope,
      intercept,
      mae,
      rmse,
      r2,
      trainingRows: training.length,
      testingRows: testing.length,
      totalRows: records.length,
      predictions: predictions.slice(0, 12),
    });
  }

  return (
    <div className="inner-page model-studio">
      <ToolPageHeader
        title="Model Studio"
        description="Train and evaluate machine-learning models using your dataset."
        icon={BrainCircuit}
      />

      {!report || preview.length === 0 ? (
        <div className="surface visualization-empty">
          <BrainCircuit size={38} />
          <h2>Your model workspace is ready</h2>
          <p>
            Upload and analyze a dataset in Data Explorer.
            Numeric preview columns will become available here.
          </p>
        </div>
      ) : (
        <>
          <div className="model-intro">
            <div>
              <span className="model-eyebrow">MACHINE LEARNING WORKSPACE</span>
              <h2>Build your first model.</h2>
              <p>
                Configure a regression experiment, train it and
                inspect its performance on unseen preview records.
              </p>
            </div>
            <div className="model-intro-icon">
              <BrainCircuit size={38} />
            </div>
          </div>

          <div className="model-stats">
            <div className="viz-kpi">
              <span>Available preview rows</span>
              <strong>{preview.length.toLocaleString()}</strong>
              <small>Rows returned by analysis</small>
            </div>
            <div className="viz-kpi">
              <span>Numeric features</span>
              <strong>{numericColumns.length}</strong>
              <small>Detected numeric columns</small>
            </div>
            <div className="viz-kpi">
              <span>Model type</span>
              <strong>Regression</strong>
              <small>Simple linear regression</small>
            </div>
          </div>

          <div className="model-workspace">
            <section className="surface model-config">
              <div className="sql-card-heading">
                <div>
                  <h3>Experiment configuration</h3>
                  <p>Choose the variables for your model.</p>
                </div>
                <Settings size={21} />
              </div>

              <label className="model-field">
                Predictor variable (X)
                <select
                  value={selectedFeature}
                  onChange={(event) => {
                    setFeature(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Select predictor</option>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <label className="model-field">
                Target variable (Y)
                <select
                  value={selectedTarget}
                  onChange={(event) => {
                    setTarget(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Select target</option>
                  {numericColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>

              <div className="model-split-info">
                <strong>Training strategy</strong>
                <p>80% training records · 20% testing records</p>
                <small>
                  Every fifth valid record is reserved for testing.
                </small>
              </div>

              <button
                className="model-train-button"
                onClick={trainModel}
              >
                <Play size={16} fill="currentColor" />
                Train regression model
              </button>

              {error && (
                <div className="sql-error">
                  <strong>Unable to train model</strong>
                  <p>{error}</p>
                </div>
              )}
            </section>

            <section className="surface model-results">
              <div className="sql-card-heading">
                <div>
                  <h3>Model performance</h3>
                  <p>Evaluation on held-out test records.</p>
                </div>
                <TrendingUp size={21} />
              </div>

              {!result ? (
                <div className="sql-results-empty">
                  <BrainCircuit size={34} />
                  <strong>No trained model yet</strong>
                  <p>Configure your variables and train the model.</p>
                </div>
              ) : (
                <>
                  <div className="model-metric-grid">
                    <div>
                      <span>MAE</span>
                      <strong>{result.mae.toFixed(4)}</strong>
                    </div>
                    <div>
                      <span>RMSE</span>
                      <strong>{result.rmse.toFixed(4)}</strong>
                    </div>
                    <div>
                      <span>R² score</span>
                      <strong>
                        {result.r2 === null
                          ? "N/A"
                          : result.r2.toFixed(4)}
                      </strong>
                    </div>
                  </div>

                  <div className="model-equation">
                    <span>Learned regression equation</span>
                    <strong>
                      Y = {result.slope.toFixed(5)}X
                      {result.intercept < 0 ? " - " : " + "}
                      {Math.abs(result.intercept).toFixed(5)}
                    </strong>
                  </div>

                  <div className="model-training-summary">
                    <div>
                      <span>Training records</span>
                      <strong>{result.trainingRows}</strong>
                    </div>
                    <div>
                      <span>Testing records</span>
                      <strong>{result.testingRows}</strong>
                    </div>
                    <div>
                      <span>Valid records</span>
                      <strong>{result.totalRows}</strong>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {result && (
            <section className="surface model-predictions">
              <div className="sql-card-heading">
                <div>
                  <h3>Prediction comparison</h3>
                  <p>Actual versus predicted values from the test set.</p>
                </div>
                <Table2 size={20} />
              </div>

              <div className="sql-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>Actual value</th>
                      <th>Predicted value</th>
                      <th>Absolute error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.predictions.map((row, index) => (
                      <tr key={index}>
                        <td>{row.actual.toFixed(4)}</td>
                        <td>{row.predicted.toFixed(4)}</td>
                        <td>
                          {Math.abs(row.actual - row.predicted).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="model-disclaimer">
                Evaluation uses only the valid records in the analysis
                preview. Results may differ when trained on the full dataset.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function getToolAnalysis(report) {
  const root = report?.analysis || {};

  if (root.sheets) {
    const firstSheet = Object.values(root.sheets).find(
      (sheet) => sheet && (sheet.rows > 0 || sheet.columns > 0)
    );

    return firstSheet || {};
  }

  return root;
}

function ToolPageHeader({ title, description, icon: Icon }) {
  return (
    <PageHeading
      eyebrow="DATAMIND / ANALYTICAL TOOLS"
      title={title}
      description={description}
    />
  );
}

function DataQualityTool({ report }) {
  const data = getToolAnalysis(report);
  const missing = data.missing_by_column || {};
  const profiles = data.column_profiles || [];

  const missingColumns = Object.entries(missing).filter(
    ([, count]) => Number(count) > 0
  );

  const totalMissing = Number(data.missing_values || 0);
  const duplicates = Number(data.duplicate_rows || 0);
  const rows = Number(data.rows || 0);

  return (
    <div className="inner-page">
      <ToolPageHeader
        title="Data Quality"
        description="Inspect missing values, duplicate records and column-level data quality."
        icon={ShieldCheck}
      />

      {!report ? (
        <div className="surface visualization-empty">
          <ShieldCheck size={34} />
          <h2>No dataset analyzed yet</h2>
          <p>Analyze a dataset in Data Explorer to see its quality checks here.</p>
        </div>
      ) : (
        <>
          <div className="viz-kpi-grid">
            <div className="viz-kpi">
              <span>Missing values</span>
              <strong>{totalMissing.toLocaleString()}</strong>
              <small>Across all columns</small>
            </div>
            <div className="viz-kpi">
              <span>Duplicate rows</span>
              <strong>{duplicates.toLocaleString()}</strong>
              <small>Repeated records</small>
            </div>
            <div className="viz-kpi">
              <span>Missing data</span>
              <strong>{data.missing_percentage ?? 0}%</strong>
              <small>Of all cells</small>
            </div>
            <div className="viz-kpi">
              <span>Rows analyzed</span>
              <strong>{rows.toLocaleString()}</strong>
              <small>Dataset records</small>
            </div>
          </div>

          <section className="surface" style={{ padding: 22, marginTop: 18 }}>
            <h2>Column quality checks</h2>
            <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 18px" }}>
              Columns with missing values are listed below.
            </p>

            {missingColumns.length ? (
              missingColumns.map(([name, count]) => (
                <div key={name} className="viz-insight">
                  <div style={{ flex: 1 }}>
                    <strong>{name}</strong>
                    <p>{count} missing values</p>
                  </div>
                  <span>{rows ? ((count / rows) * 100).toFixed(1) : 0}%</span>
                </div>
              ))
            ) : (
              <p>No missing values were detected in the analyzed dataset.</p>
            )}

            <h3 style={{ marginTop: 24 }}>Column profiles</h3>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Missing</th>
                    <th>Unique values</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((item, index) => (
                    <tr key={`${item.column}-${index}`}>
                      <td>{item.column}</td>
                      <td>{item.column_type || item.data_type}</td>
                      <td>{item.missing_count}</td>
                      <td>{item.unique_values}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function DataCleaningTool({ report }) {
  const data = getToolAnalysis(report);
  const missing = data.missing_by_column || {};

  const tasks = Object.entries(missing)
    .filter(([, count]) => Number(count) > 0)
    .map(([name, count]) => ({
      title: `Review missing values in ${name}`,
      detail: `${count} missing values detected. Decide whether to impute, retain or remove affected records.`
    }));

  if (Number(data.duplicate_rows) > 0) {
    tasks.push({
      title: "Review duplicate records",
      detail: `${data.duplicate_rows} duplicate rows detected. Verify whether they are genuine duplicates before removal.`
    });
  }

  const profiles = data.column_profiles || [];

  profiles.forEach((item) => {
    if (item.column_type === "identifier") {
      tasks.push({
        title: `Preserve identifier column: ${item.column}`,
        detail: "Keep this field as an identifier. Do not calculate statistical averages or automatically modify its values."
      });
    }
  });

  return (
    <div className="inner-page">
      <ToolPageHeader
        title="Data Cleaning"
        description="Review data issues and prepare a safe cleaning plan."
        icon={Sparkles}
      />

      {!report ? (
        <div className="surface visualization-empty">
          <Sparkles size={34} />
          <h2>No dataset available</h2>
          <p>Analyze a dataset in Data Explorer to generate a cleaning plan.</p>
        </div>
      ) : (
        <section className="surface" style={{ padding: 22 }}>
          <h2>Recommended cleaning tasks</h2>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 20px" }}>
            These are recommendations based on the available analysis.
            Your original dataset has not been changed.
          </p>

          {tasks.length ? (
            tasks.map((task, index) => (
              <div className="viz-insight" key={index}>
                <span><Sparkles size={17} /></span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No missing-value or duplicate-row cleaning tasks were detected.</p>
          )}
        </section>
      )}
    </div>
  );
}

function CorrelationLab({ report }) {
  const data = getToolAnalysis(report);
  const matrix = data.correlation_matrix || {};
  const columns = Object.keys(matrix);

  function correlationColor(value) {
    if (value === null || value === undefined) return "transparent";
    const intensity = Math.min(Math.abs(Number(value)), 1);
    return Number(value) >= 0
      ? `rgba(57, 151, 125, ${0.12 + intensity * 0.5})`
      : `rgba(184, 77, 61, ${0.12 + intensity * 0.5})`;
  }

  return (
    <div className="inner-page">
      <ToolPageHeader
        title="Correlation Lab"
        description="Explore relationships between eligible numerical variables."
        icon={Activity}
      />

      {!report ? (
        <div className="surface visualization-empty">
          <Activity size={34} />
          <h2>No dataset analyzed yet</h2>
          <p>Analyze a dataset with at least two numeric columns first.</p>
        </div>
      ) : columns.length < 2 ? (
        <div className="surface visualization-empty">
          <h2>Not enough numerical variables</h2>
          <p>
            Correlation analysis requires at least two eligible numeric columns.
            Identifier columns are excluded.
          </p>
        </div>
      ) : (
        <section className="surface" style={{ padding: 22 }}>
          <h2>Correlation matrix</h2>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "8px 0 20px" }}>
            Values range from -1 to +1. Correlation does not establish causation.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table correlation-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  {columns.map((name) => <th key={name}>{name}</th>)}
                </tr>
              </thead>
              <tbody>
                {columns.map((rowName) => (
                  <tr key={rowName}>
                    <th>{rowName}</th>
                    {columns.map((colName) => {
                      const value = matrix[rowName]?.[colName];

                      return (
                        <td
                          key={colName}
                          style={{
                            background: correlationColor(value),
                            textAlign: "center",
                            fontWeight: 700,
                            minWidth: 75
                          }}
                        >
{value !== null && value !== undefined &&
 Number.isFinite(Number(value))
  ? Number(value).toFixed(2)
  : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, opacity: 0.7, marginTop: 16 }}>
            Green indicates positive correlation; red indicates negative correlation.
          </p>
        </section>
      )}
    </div>
  );
}

function ExportCentre({ reports }) {
  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportJson(report) {
    downloadFile(
      `${report.title || "datamind-report"}.json`,
      JSON.stringify(report, null, 2),
      "application/json"
    );
  }

  function exportCsv(report) {
    const data = getToolAnalysis(report);
    const rows = [
      ["Metric", "Value"],
      ["Filename", report.filename || ""],
      ["Rows", data.rows ?? ""],
      ["Columns", data.columns ?? ""],
      ["Missing values", data.missing_values ?? ""],
      ["Duplicate rows", data.duplicate_rows ?? ""],
      ...Object.entries(data.outlier_counts || {}).map(
        ([column, count]) => [`Outliers: ${column}`, count]
      )
    ];

    const csv = rows.map((row) =>
      row.map((value) =>
        `"${String(value).replace(/"/g, '""')}"`
      ).join(",")
    ).join("\n");

    downloadFile(
      `${report.title || "datamind-report"}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="inner-page">
      <ToolPageHeader
        title="Export Centre"
        description="Download your saved DataMind reports and analysis summaries."
        icon={FileSpreadsheet}
      />

      <div className="viz-kpi-grid">
        <div className="viz-kpi">
          <span>Saved reports</span>
          <strong>{reports.length}</strong>
          <small>Available to export</small>
        </div>
      </div>

      <section className="surface" style={{ padding: 22, marginTop: 18 }}>
        <h2>Available exports</h2>

        {reports.length ? reports.map((report) => (
          <div
            key={report.id}
            className="viz-insight"
            style={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ flex: 1 }}>
              <strong>{report.title || report.filename}</strong>
              <p>{report.analysis_type || "Analysis"} · {report.filename}</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => exportCsv(report)}
            >
              Export CSV
            </button>

            <button
              className="primary-button"
              onClick={() => exportJson(report)}
            >
              Export JSON
            </button>
          </div>
        )) : (
          <div className="visualization-empty">
            <FileSpreadsheet size={32} />
            <h2>No saved reports</h2>
            <p>Save an analysis in Data Explorer before exporting it.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState(() => {
    try {
      return {
        workspaceName: "My Workspace",
        displayName: "Allen",
        role: "Data Scientist",
        theme: "light",
        density: "comfortable",
        defaultChart: "bar",
        numberFormat: "standard",
        analysisDetail: "detailed",
        confirmDelete: true,
        ...JSON.parse(
          localStorage.getItem("datamind_preferences") || "{}"
        ),
      };
    } catch {
      return {
        workspaceName: "My Workspace",
        displayName: "Allen",
        role: "Data Scientist",
        theme: "light",
        density: "comfortable",
        defaultChart: "bar",
        numberFormat: "standard",
        analysisDetail: "detailed",
        confirmDelete: true,
      };
    }
  });

  const [saved, setSaved] = useState(false);

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
    setSaved(false);
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        "datamind_preferences",
        JSON.stringify(settings)
      );

      document.documentElement.dataset.density = settings.density;
      document.documentElement.dataset.theme = settings.theme;

      setSaved(true);
    } catch (error) {
      console.error("Settings save failed:", error);
      window.alert("Could not save your preferences.");
    }
  }

  function resetSettings() {
    const defaults = {
      workspaceName: "My Workspace",
      displayName: "Allen",
      role: "Data Scientist",
      theme: "light",
      density: "comfortable",
      defaultChart: "bar",
      numberFormat: "standard",
      analysisDetail: "detailed",
      confirmDelete: true,
    };

    setSettings(defaults);
    localStorage.setItem(
      "datamind_preferences",
      JSON.stringify(defaults)
    );

    document.documentElement.dataset.density = "comfortable";
    document.documentElement.dataset.theme = "light";
    setSaved(true);
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    border: "1px solid var(--border)",
    borderRadius: 9,
    background: "var(--bg)",
    color: "var(--text-h)",
    fontSize: 13,
  };

  function SettingField({ label, description, children }) {
    return (
      <div className="settings-field">
        <div>
          <strong>{label}</strong>
          <p>{description}</p>
        </div>
        <div className="settings-control">{children}</div>
      </div>
    );
  }

  function SettingsSection({ icon: Icon, title, description, children }) {
    return (
      <section className="surface settings-section">
        <div className="settings-section-heading">
          <div className="settings-icon">
            <Icon size={20} />
          </div>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {children}
      </section>
    );
  }

  return (
    <div className="inner-page settings-page">
      <PageHeading
        eyebrow="DATAMIND / CONFIGURATION"
        title="Settings Centre"
        description="Configure your workspace and analytical experience."
      />

      <div className="settings-overview">
        <div>
          <span>WORKSPACE PLAN</span>
          <strong>Personal Workspace</strong>
          <small>Local browser configuration</small>
        </div>
        <div>
          <span>PREFERENCES</span>
          <strong>Customizable</strong>
          <small>Saved in this browser</small>
        </div>
        <div>
          <span>AI PROVIDER</span>
          <strong>Gemini + Groq fallback</strong>
          <small>Managed by backend configuration</small>
        </div>
      </div>

      <SettingsSection
        icon={Building2}
        title="Workspace profile"
        description="Manage your workspace identity."
      >
        <SettingField
          label="Workspace name"
          description="Name displayed for your workspace."
        >
          <input
            style={fieldStyle}
            value={settings.workspaceName}
            onChange={(e) =>
              updateSetting("workspaceName", e.target.value)
            }
          />
        </SettingField>

        <SettingField
          label="Display name"
          description="Your preferred account display name."
        >
          <input
            style={fieldStyle}
            value={settings.displayName}
            onChange={(e) =>
              updateSetting("displayName", e.target.value)
            }
          />
        </SettingField>

        <SettingField
          label="Professional role"
          description="Your role within this workspace."
        >
          <input
            style={fieldStyle}
            value={settings.role}
            onChange={(e) =>
              updateSetting("role", e.target.value)
            }
          />
        </SettingField>
      </SettingsSection>

      <SettingsSection
        icon={Palette}
        title="Appearance"
        description="Customize the interface presentation."
      >
        <SettingField
          label="Theme"
          description="Choose your preferred interface theme."
        >
          <select
            style={fieldStyle}
            value={settings.theme}
            onChange={(e) =>
              updateSetting("theme", e.target.value)
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark preference</option>
          </select>
        </SettingField>

        <SettingField
          label="Interface density"
          description="Choose the spacing of workspace elements."
        >
          <select
            style={fieldStyle}
            value={settings.density}
            onChange={(e) =>
              updateSetting("density", e.target.value)
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </SettingField>
      </SettingsSection>

      <SettingsSection
        icon={ChartNoAxesCombined}
        title="Analysis preferences"
        description="Set defaults for your analytical workflow."
      >
        <SettingField
          label="Default chart type"
          description="Preferred starting chart for visualizations."
        >
          <select
            style={fieldStyle}
            value={settings.defaultChart}
            onChange={(e) =>
              updateSetting("defaultChart", e.target.value)
            }
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
            <option value="histogram">Histogram</option>
            <option value="scatter">Scatter plot</option>
          </select>
        </SettingField>

        <SettingField
          label="Number formatting"
          description="Choose how numbers are displayed."
        >
          <select
            style={fieldStyle}
            value={settings.numberFormat}
            onChange={(e) =>
              updateSetting("numberFormat", e.target.value)
            }
          >
            <option value="standard">Standard</option>
            <option value="compact">Compact (1.2K, 2.5M)</option>
          </select>
        </SettingField>

        <SettingField
          label="AI analysis detail"
          description="Preferred level of analytical explanation."
        >
          <select
            style={fieldStyle}
            value={settings.analysisDetail}
            onChange={(e) =>
              updateSetting("analysisDetail", e.target.value)
            }
          >
            <option value="concise">Concise</option>
            <option value="detailed">Detailed</option>
            <option value="technical">Technical</option>
          </select>
        </SettingField>
      </SettingsSection>

      <SettingsSection
        icon={ShieldCheck}
        title="Data and privacy"
        description="Review how this browser handles your preferences."
      >
        <SettingField
          label="Confirm before deleting"
          description="Keep an extra confirmation before report deletion."
        >
          <input
            type="checkbox"
            checked={settings.confirmDelete}
            onChange={(e) =>
              updateSetting("confirmDelete", e.target.checked)
            }
          />
        </SettingField>

        <div className="settings-notice">
          <ShieldCheck size={18} />
          <p>
            Your preferences are stored in this browser's local storage.
            AI provider credentials must remain on the backend and should
            never be entered here.
          </p>
        </div>
      </SettingsSection>

      <div className="settings-footer">
        <button
          className="secondary-button"
          onClick={resetSettings}
        >
          Reset defaults
        </button>

        <button
          className="primary-button"
          onClick={saveSettings}
        >
          <Settings size={16} />
          Save preferences
        </button>
      </div>

      {saved && (
        <p className="settings-saved">
          <CheckCircle size={16} />
          Preferences saved successfully.
        </p>
      )}
    </div>
  );
}


export default App;
