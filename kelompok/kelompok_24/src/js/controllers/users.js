// src/js/controllers/users.js

/**
 * users.js – Retro Japan / Arknights Themed User Manager
 */

let users = [
  { id: 1, name: "Amiya", email: "amiya@rhodes.com", role: "Admin", status: "Active" },
  { id: 2, name: "Texas", email: "texas@penguin.com", role: "Staff", status: "Inactive" },
];

let editingUser = null;

// Render Table
function renderUsers() {
  const tbody = document.getElementById("userTable");
  tbody.innerHTML = "";

  users.forEach((u) => {
    tbody.innerHTML += `
      <tr class="border-b border-warkops-surface hover:bg-warkops-surface/40 transition">
        <td class="py-2">${u.name}</td>
        <td class="py-2">${u.email}</td>
        <td class="py-2">${u.role}</td>
        <td class="py-2">
            <span class="px-2 py-1 text-xs rounded 
                ${u.status === "Active" ? "bg-warkops-success text-black" : "bg-warkops-muted text-warkops-dark"}">
                ${u.status}
            </span>
        </td>

        <td class="py-2 text-right">
          <button onclick="editUser(${u.id})"
                  class="text-warkops-secondary hover:underline mr-3">Edit</button>

          <button onclick="deleteUser(${u.id})"
                  class="text-warkops-primary hover:underline">Delete</button>
        </td>
      </tr>
    `;
  });
}

renderUsers();

// Modal Controls
function openAddUserModal() {
  editingUser = null;

  document.getElementById("modalTitle").innerText = "Add New Operator";
  document.getElementById("nameInput").value = "";
  document.getElementById("emailInput").value = "";
  document.getElementById("roleInput").value = "Staff";
  document.getElementById("statusInput").value = "Active";

  document.getElementById("userModal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("userModal").classList.add("hidden");
}

function editUser(id) {
  editingUser = id;
  const u = users.find(u => u.id === id);

  document.getElementById("modalTitle").innerText = "Edit Operator";
  document.getElementById("nameInput").value = u.name;
  document.getElementById("emailInput").value = u.email;
  document.getElementById("roleInput").value = u.role;
  document.getElementById("statusInput").value = u.status;

  document.getElementById("userModal").classList.remove("hidden");
}

function saveUser() {
  const name = document.getElementById("nameInput").value;
  const email = document.getElementById("emailInput").value;
  const role = document.getElementById("roleInput").value;
  const status = document.getElementById("statusInput").value;

  if (editingUser === null) {
    // Add
    users.push({
      id: Date.now(),
      name, email, role, status
    });
  } else {
    // Update
    const u = users.find(u => u.id === editingUser);
    u.name = name;
    u.email = email;
    u.role = role;
    u.status = status;
  }

  closeModal();
  renderUsers();
}

function deleteUser(id) {
  users = users.filter(u => u.id !== id);
  renderUsers();
}
