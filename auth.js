// ===== EduPath 邮箱登录 (仅邮箱/密码，不涉及GitHub) =====
const supabase = supabase.createClient(
  'https://lanrfnbdkjemwbtddsjh.supabase.co',  // your Project URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbnJmbmJka2plbXdidGRkc2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwOTM1OTksImV4cCI6MjEwNjY2OTU5OX0.4IGKiYbCfRsm8Vwq3nsS5BPOOZOZogHAVi-tiApBRy0'  // your anon key
)

// 1. 登录函数
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) alert('登录失败: ' + error.message)
  else {
    alert('🎉 登录成功！欢迎回来')
    location.reload()  // 刷新页面，保持登录态
  }
}

// 2. 注册函数 (必须使用有效的邮箱格式，如 name@gmail.com)
async function register(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email, password, data: { full_name: name }
  })
  if (error) alert('注册失败: ' + error.message)  // 常见原因：邮箱格式错误
  else {
    alert('注册成功！请检查邮箱（如果启用了确认，需点击邮件链接确认）')
    // 如果Supabase设置了邮箱确认，新用户需点击邮件链接才能登录
    // 如果不确认也能登录，直接 login 即可
  }
}

// 3. 登出
function logout() {
  supabase.auth.signOut()
  alert('已退出登录')
  location.reload()
}
