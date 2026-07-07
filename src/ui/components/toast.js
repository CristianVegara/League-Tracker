let timer = null;

export function showToast(message){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

export function bindToastEvents(){
  window.addEventListener("app:toast", event => showToast(event.detail));
}
