// ===== EduPath 简易认证 (使用 Supabase + GitHub 登录) =====
// 1. 初始化 Supabase (把你的 URL 和 anon key 填进去)
const supabase = supabase.createClient(
  'https://lmhcoxtgtmndthscsgjg.supabase.co',  // ← 你的 Project URL (一定要是这个)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtaGNveHRndG1uZHRoc2NzZ2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NjA2OTMsImV4cCI6MjEwNjUzNjY5M30.LntM4ZDg4TQnl9BlRwivdYbmwgeuBxLt-h_kIDGES6g'  // ← anon key
);

// 2. GitHub 登录函数
async function githubLogin() {
  // 弹出 GitHub 登录窗口，用户授权后会返回到当前页
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    // redirectTo 是关键：登录成功后会回到这个页面，并附带 token
    redirectTo: window.location.origin + '/auth/callback' 
  })
  
  if (error) {
    alert('GitHub 登录失败: ' + error.message)
    return false
  }

  // 如果没有 error，用户已通过 GitHub 登录
  // 下面会自动跳转回 redirectTo 的页面，或者你可以手动获取 session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    // 有登录态，把 token 传给后端（可选，这里演示保存数据）
    // 这里先alert成功，实际项目中通常跳转到主页
    alert('🎉 登录成功！欢迎回来，' + session.user.email)
    // 这里可以调用保存大学的 API：saveUniversity(...)
    return true
  }
  
  return false
}

// 3. 普通登录/注册 (邮箱密码，作为备用)
async function register(name, email, pwd) {
  const { data, error } = await supabase.auth.signUp({
    email, password: pwd, data: { full_name: name }
  })
  if (error) alert('注册失败: ' + error.message)
  else alert('注册成功！请使用 GitHub 登录')
}

async function login(email, pwd) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
  if (error) alert('登录失败: ' + error.message)
  else alert('登录成功！欢迎回来')
}
