// Update these two values to match your bot's current reach.
const giantStats = {
  servers: 128,
  users: 25000,
};

const numberFormatter = new Intl.NumberFormat("en-US");

document.getElementById("server-count").textContent =
  `${numberFormatter.format(giantStats.servers)}+`;
document.getElementById("user-count").textContent =
  `${numberFormatter.format(giantStats.users)}+`;
