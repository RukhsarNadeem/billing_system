// login.js — Sweet Bills Login Page

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
const loginBtn = document.getElementById('loginBtn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');
const togglePw = document.getElementById('togglePw');
const pwInput = document.getElementById('password');

// Toggle password visibility
togglePw.addEventListener('click', () => {
  const isText = pwInput.type === 'text';
  pwInput.type = isText ? 'password' : 'text';
  togglePw.textContent = isText ? '👁' : '🙈';
});

// Handle login submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  errorMsg.textContent = '';

  // Show loader
  loginBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      window.location.href = data.redirect;
    } else {
      errorMsg.textContent = data.message || 'Invalid credentials.';
    }
  } catch (err) {
    errorMsg.textContent = 'Server error. Please try again.';
  } finally {
    loginBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
});

// Allow Enter key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') form.requestSubmit();
});
