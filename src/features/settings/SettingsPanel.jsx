import React, { useState, useEffect } from "react";
import { X, Palette, Type, Cpu, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const SettingsPanel = ({ currentTheme, onThemeChange, onClose }) => {
  const [activeTab, setActiveTab] = useState("appearance");

  // Handle ESC key to close settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const themes = [
    { id: "dark", name: "Community Dark", class: "preview-dark" },
    { id: "light", name: "Modern Light", class: "preview-light" },
  ];

  const renderAppearance = () => (
    <div className="settings-section">
      <h3>Color Theme</h3>
      <div className="settings-item">
        <div className="settings-item-label">Global Theme</div>
        <div className="settings-item-description">Select the primary color palette for the entire IDE.</div>
        <div className="theme-grid">
          {themes.map((theme) => (
            <Button
              key={theme.id}
              type="button"
              variant="ghost"
              aria-pressed={currentTheme === theme.id}
              className={`theme-card ${currentTheme === theme.id ? "active" : ""}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <div className={`theme-preview ${theme.class}`}>
                <div className="preview-sidebar" />
                <div className="preview-editor" />
              </div>
              <span>{theme.name}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="settings-section">
      <h3>Editor Settings</h3>
      <div className="settings-item">
        <Label className="settings-item-label" htmlFor="editor-font-family">Font Family</Label>
        <div className="settings-item-description">Controls the font used in the editor and terminal.</div>
        <Input id="editor-font-family" className="sidebar-inline-input-field" disabled value="JetBrains Mono, Fira Code" style={{ marginTop: "8px", width: "100%", maxWidth: "400px" }} />
      </div>
      <div className="settings-item">
        <Label className="settings-item-label" htmlFor="editor-font-size">Font Size</Label>
        <div className="settings-item-description">Adjust the size of the editor text (Coming soon).</div>
        <Input id="editor-font-size" type="number" className="sidebar-inline-input-field" disabled value="14" style={{ marginTop: "8px", width: "100px" }} />
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="settings-panel">
      <div className="settings-nav">
        <div className="settings-nav-title">Settings</div>
        <TabsList variant="line" className="settings-tab-list" aria-label="Settings sections">
          <TabsTrigger value="appearance" className="settings-nav-item"><Palette size={16} /> Appearance</TabsTrigger>
          <TabsTrigger value="editor" className="settings-nav-item"><Type size={16} /> Editor</TabsTrigger>
          <TabsTrigger value="accessibility" className="settings-nav-item" disabled><Monitor size={16} /> Accessibility</TabsTrigger>
          <TabsTrigger value="performance" className="settings-nav-item" disabled><Cpu size={16} /> Performance</TabsTrigger>
        </TabsList>
      </div>

      <div className="settings-content">
        {/* Global Close Button - Fixed to top right of page */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="sidebar-action" 
          aria-label="Close settings"
          title="Close Settings (ESC)"
          style={{ 
            position: "absolute",
            top: "24px",
            right: "24px",
            width: "32px", 
            height: "32px", 
            fontSize: "20px",
            zIndex: 100
          }}
        >
          <X size={20} />
        </Button>

        <div className="settings-header">
          <h2>Settings</h2>
          <p>Configure Velo Arc to match your workflow.</p>
        </div>

        <TabsContent value="appearance">{renderAppearance()}</TabsContent>
        <TabsContent value="editor">{renderEditor()}</TabsContent>
      </div>
    </Tabs>
  );
};

export default SettingsPanel;
