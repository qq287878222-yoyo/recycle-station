import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import '@ant-design/v5-patch-for-react-19';
import 'antd/dist/reset.css';
import './index.css';
import App from './App';

// 全局错误捕获:写入 localStorage,便于线上问题排查(在控制台执行 localStorage.getItem('last_app_error') 查看)
window.addEventListener('error', (e) => {
  try {
    localStorage.setItem(
      'last_app_error',
      JSON.stringify({ time: new Date().toISOString(), type: 'error', message: e.message, stack: e.error?.stack?.slice(0, 800) })
    );
  } catch { /* 忽略 */ }
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    localStorage.setItem(
      'last_app_error',
      JSON.stringify({ time: new Date().toISOString(), type: 'unhandledrejection', message: String(e.reason?.message ?? e.reason) })
    );
  } catch { /* 忽略 */ }
});

/** 渲染错误边界:崩溃时把错误展示在页面上,避免白屏 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    try {
      localStorage.setItem(
        'last_app_error',
        JSON.stringify({ time: new Date().toISOString(), type: 'render', message: error.message, stack: error.stack?.slice(0, 800) })
      );
    } catch { /* 忽略 */ }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#f5222d' }}>页面出错了</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff1f0', padding: 12, borderRadius: 6 }}>
            {this.state.error.message}
          </pre>
          <button onClick={() => location.reload()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#52c41a' } }}>
      <AntdApp>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>
);
