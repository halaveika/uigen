import { test, expect, vi, afterEach, beforeEach, describe } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MainContent } from "../main-content";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock providers as pass-through wrappers
vi.mock("@/lib/contexts/file-system-context", () => ({
  FileSystemProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  useFileSystem: vi.fn(),
}));

vi.mock("@/lib/contexts/chat-context", () => ({
  ChatProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  useChat: vi.fn(),
}));

// Mock leaf components to keep tests fast and focused
vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));

vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">File Tree</div>,
}));

vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">Code Editor</div>,
}));

vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}));

vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions">Actions</div>,
}));

// Mock resizable panels — react-resizable-panels uses ResizeObserver which isn't in jsdom
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="resizable-group">
      {children}
    </div>
  ),
  ResizablePanel: ({
    children,
  }: {
    children: ReactNode;
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
  }) => <div>{children}</div>,
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("MainContent toggle behavior", () => {
  test("renders with Preview tab active by default", () => {
    render(<MainContent />);

    const previewTab = screen.getByRole("tab", { name: "Preview" });
    const codeTab = screen.getByRole("tab", { name: "Code" });

    expect(previewTab.getAttribute("data-state")).toBe("active");
    expect(codeTab.getAttribute("data-state")).toBe("inactive");
  });

  test("shows PreviewFrame by default", () => {
    render(<MainContent />);

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("file-tree")).toBeNull();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("switches to code view when Code tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    const codeTab = screen.getByRole("tab", { name: "Code" });
    await user.click(codeTab);

    expect(screen.getByTestId("file-tree")).toBeDefined();
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  test("switches back to preview view when Preview tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Go to code view first
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("code-editor")).toBeDefined();

    // Switch back to preview
    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("updates tab active state when switching to Code", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(
      screen.getByRole("tab", { name: "Code" }).getAttribute("data-state")
    ).toBe("active");
    expect(
      screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")
    ).toBe("inactive");
  });

  test("updates tab active state when switching back to Preview", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(
      screen.getByRole("tab", { name: "Preview" }).getAttribute("data-state")
    ).toBe("active");
    expect(
      screen.getByRole("tab", { name: "Code" }).getAttribute("data-state")
    ).toBe("inactive");
  });

  test("can toggle multiple times without getting stuck", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Cycle through several times
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole("tab", { name: "Code" }));
      expect(screen.getByTestId("code-editor")).toBeDefined();

      await user.click(screen.getByRole("tab", { name: "Preview" }));
      expect(screen.getByTestId("preview-frame")).toBeDefined();
    }
  });

  test("clicking the already-active Preview tab keeps preview view visible", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Click Preview when it's already active — should remain on preview
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("clicking the already-active Code tab keeps code view visible", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));
    // Click Code again while it's active
    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  test("renders chat interface in both views", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    expect(screen.getByTestId("chat-interface")).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("chat-interface")).toBeDefined();
  });
});
