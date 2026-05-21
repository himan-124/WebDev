const tempUser = { username: "visitor", password: "12345" };

function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  if (user === tempUser.username && pass === tempUser.password) {
    localStorage.setItem("loggedInUser", user);
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("travelForm").style.display = "block";
    alert("Welcome to Incredible India, " + user + "!");
  } else {
    alert("Invalid login. Try visitor / 12345");
  }
}

function logout() {
  localStorage.removeItem("loggedInUser");
  document.getElementById("travelForm").style.display = "none";
  document.getElementById("loginBox").style.display = "block";
}

function showPackages() {
  const destination = document.getElementById("destination").value.toLowerCase();
  const budget = parseInt(document.getElementById("budget").value);
  const days = parseInt(document.getElementById("days").value);
  const packagesDiv = document.getElementById("packages");
  packagesDiv.innerHTML = "";

  const indianPackages = [
    { place: "Goa", pricePerDay: 2500, img: "https://source.unsplash.com/400x250/?goa" },
    { place: "Jaipur", pricePerDay: 3000, img: "https://source.unsplash.com/400x250/?jaipur" },
    { place: "Kerala", pricePerDay: 3500, img: "https://source.unsplash.com/400x250/?kerala" },
    { place: "Ladakh", pricePerDay: 4000, img: "https://source.unsplash.com/400x250/?ladakh" },
    { place: "Varanasi", pricePerDay: 2000, img: "https://source.unsplash.com/400x250/?varanasi" },
    { place: "Shimla", pricePerDay: 2800, img: "https://source.unsplash.com/400x250/?shimla" },
    { place: "Mumbai", pricePerDay: 3200, img: "https://source.unsplash.com/400x250/?mumbai" },
    { place: "Delhi", pricePerDay: 3100, img: "https://source.unsplash.com/400x250/?delhi" }
  ];

  const filtered = indianPackages.filter(pkg =>
    pkg.place.toLowerCase() === destination &&
    (pkg.pricePerDay * days) <= budget
  );

  if (filtered.length > 0) {
    filtered.forEach(pkg => {
      const totalCost = pkg.pricePerDay * days;
      const card = document.createElement("div");
      card.className = "package";
      card.innerHTML = `
        <img src="${pkg.img}" alt="${pkg.place}">
        <h3>${pkg.place}</h3>
        <p>₹${pkg.pricePerDay} per day</p>
        <p>Total for ${days} days: ₹${totalCost}</p>`;
      packagesDiv.appendChild(card);
    });
  } else {
    packagesDiv.innerHTML = "<p>No packages found within your budget.</p>";
  }
}

function chat() {
  const input = document.getElementById("chatInput").value;
  const chatWindow = document.getElementById("chatWindow");
  if (!input) return;

  const userMsg = document.createElement("div");
  userMsg.className = "chat-message user";
  userMsg.textContent = input;
  chatWindow.appendChild(userMsg);

  const botMsg = document.createElement("div");
  botMsg.className = "chat-message bot";

  if (input.toLowerCase().includes("best time")) {
    botMsg.textContent = "Best time to visit India is from October to March.";
    } else if (input.toLowerCase().includes("visa")) {
    botMsg.textContent = "You can apply for an e-visa online for tourism purposes.";
    } else if (input.toLowerCase().includes("packages")) {
    botMsg.textContent = "Use the form above to find travel packages based on your preferences.";
  } else {
    botMsg.textContent = "Sorry, I can only answer questions about travel packages, best time to visit, and visa information.";
  }
  chatWindow.appendChild(botMsg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}