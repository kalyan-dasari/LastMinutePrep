function showToast(message, type = "info") {
  const container = document.querySelector(".toast-container") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span><button class="toast-close" aria-label="Close">&times;</button>`;
  container.appendChild(toast);

  const closeBtn = toast.querySelector(".toast-close");
  const remove = () => toast.remove();

  closeBtn.addEventListener("click", remove);
  setTimeout(remove, 3000);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

function initMobileNav() {
  const toggle = document.getElementById("mobileNavToggle");
  const nav = document.getElementById("navLinks");

  if (!toggle || !nav) return;

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  document.body.appendChild(overlay);

  const closeNav = () => {
    toggle.classList.remove("active");
    nav.classList.remove("open");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  };

  const openNav = () => {
    toggle.classList.add("active");
    nav.classList.add("open");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  toggle.addEventListener("click", () => {
    if (nav.classList.contains("open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  overlay.addEventListener("click", closeNav);

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (nav.classList.contains("open")) {
        closeNav();
      }
    });
  });
}

function initSearchAutocomplete() {
  const searchInput = document.querySelector('input[name="q"]');
  if (!searchInput) return;

  const form = searchInput.closest("form");
  if (!form) return;

  const dropdown = document.createElement("div");
  dropdown.className = "search-suggestions";
  searchInput.parentNode.style.position = "relative";
  searchInput.parentNode.appendChild(dropdown);

  let debounceTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      dropdown.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/search/suggestions?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderSuggestions(data.suggestions, dropdown, form);
      } catch (err) {
        console.error("Search suggestions failed:", err);
      }
    }, 200);
  });

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim().length >= 2 && dropdown.children.length > 0) {
      dropdown.querySelector(".search-dropdown")?.classList.add("active");
    }
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== searchInput) {
      dropdown.innerHTML = "";
    }
  });
}

function renderSuggestions(suggestions, container, form) {
  container.innerHTML = "";
  if (suggestions.length === 0) return;

  const dropdown = document.createElement("div");
  dropdown.className = "search-dropdown";

  suggestions.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "search-dropdown-item";
    div.innerHTML = `<span>${item.text}</span><span class="type-badge">${item.type}</span>`;
    div.addEventListener("click", () => {
      if (item.type === "note") {
        window.location.href = `/notes/${item.id}`;
      } else if (item.type === "subject") {
        const subjectInput = form.querySelector('input[name="subject"]');
        if (subjectInput) subjectInput.value = item.text;
        form.submit();
      } else if (item.type === "branch") {
        const branchInput = form.querySelector('input[name="branch"]');
        if (branchInput) branchInput.value = item.text;
        form.submit();
      }
      container.innerHTML = "";
    });
    dropdown.appendChild(div);
  });

  container.appendChild(dropdown);
}

function initInfiniteScroll() {
  const feedSection = document.querySelector(".cards-grid");
  if (!feedSection) return;

  const sentinel = document.createElement("div");
  sentinel.className = "infinite-sentinel";
  sentinel.textContent = "Scroll to load more...";
  feedSection.parentNode.appendChild(sentinel);

  let loading = false;
  let page = 1;
  const pageSize = 12;

  async function loadMore() {
    if (loading) return;
    loading = true;
    sentinel.textContent = "Loading more notes...";

    try {
      const params = new URLSearchParams(window.location.search);
      params.set("page", page);
      params.set("limit", pageSize);

      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();

      if (data.notes.length === 0) {
        sentinel.textContent = "No more notes.";
        return;
      }

      data.notes.forEach((note) => {
        const card = createNoteCard(note);
        feedSection.appendChild(card);
      });

      page++;
      if (data.notes.length < pageSize) {
        sentinel.textContent = "All notes loaded.";
      }
    } catch (err) {
      console.error(err);
      sentinel.textContent = "Failed to load more. Scroll to retry.";
    } finally {
      loading = false;
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    },
    { rootMargin: "200px" }
  );

  observer.observe(sentinel);
}

function createNoteCard(note) {
  const article = document.createElement("article");
  article.className = "note-card reveal-on-scroll card-clickable";
  article.setAttribute("data-href", note.file_path);
  article.setAttribute("data-target-blank", "true");
  article.innerHTML = `
    <div class="chip-row">
      <span class="chip">${note.subject}</span>
      <span class="chip muted">${note.exam_type}</span>
    </div>
    <h3>${note.title}</h3>
    <p>By <a href="/profile/${note.user_id}">${note.contributor_name}</a></p>
    <p class="meta">${note.branch} | ${note.year} Year</p>
    <div class="metrics">
      <span>👍 ${note.likes_count}</span>
      <span>👁️ ${note.views_count}</span>
    </div>
    <div class="card-actions">
      <form method="post" action="/notes/${note.id}/like" class="inline-form no-card-nav">
        <input type="hidden" name="redirect_to" value="/" />
        <button type="submit" class="btn-secondary">Like 👍</button>
      </form>
      <a href="${note.file_path}" target="_blank" rel="noopener" class="btn-primary no-card-nav">Open PDF</a>
      <a href="/notes/${note.id}" class="btn-secondary no-card-nav">Discussion</a>
    </div>
  `;
  return article;
}

function initShareButton() {
  const shareBtn = document.getElementById("shareNoteBtn");
  if (!shareBtn) return;

  shareBtn.addEventListener("click", async () => {
    const noteId = shareBtn.dataset.noteId;
    try {
      const res = await fetch(`/notes/${noteId}/share`);
      if (!res.ok) throw new Error("Failed to get share link");
      const data = await res.json();
      await navigator.clipboard.writeText(data.shareUrl);
      showToast("Link copied to clipboard!", "success");
    } catch (err) {
      showToast("Failed to copy link.", "error");
    }
  });
}

function copyShareUrl() {
  const input = document.getElementById("shareUrl");
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast("Link copied to clipboard!", "success");
  });
}

function initSkeletons() {
  const cardsGrid = document.querySelector(".cards-grid");
  if (!cardsGrid) return;

  const originalChildren = Array.from(cardsGrid.children);
  const skeletons = Array.from({ length: 6 }, () => {
    const div = document.createElement("div");
    div.className = "skeleton skeleton-card";
    return div;
  });

  skeletons.forEach((s) => cardsGrid.appendChild(s));

  if (document.readyState === "complete") {
    revealContent();
  } else {
    window.addEventListener("load", revealContent);
  }

  function revealContent() {
    skeletons.forEach((s) => s.remove());
    originalChildren.forEach((c) => {
      c.style.opacity = "0";
      c.style.animation = "rise 0.45s ease both";
    });
  }
}

function initRevealOnScroll() {
  const revealItems = document.querySelectorAll(".reveal-on-scroll");

  if (revealItems.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.animationDelay = `${Math.random() * 0.12}s`;
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }
}

function initClickableCards() {
  const clickableCards = document.querySelectorAll(".card-clickable[data-href]");

  clickableCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      const target = event.target;
      if (target.closest("a, button, form, input, textarea, select, .no-card-nav")) return;

      const href = card.getAttribute("data-href");
      if (!href || href === "#") return;

      if (card.getAttribute("data-target-blank") === "true") {
        window.open(href, "_blank", "noopener");
        return;
      }

      window.location.href = href;
    });
  });
}

function initPage() {
  initMobileNav();
  initSearchAutocomplete();
  initShareButton();
  initSkeletons();
  initRevealOnScroll();
  initClickableCards();

  const isFeedPage = document.querySelector(".cards-grid") && window.location.pathname === "/";
  if (isFeedPage) {
    initInfiniteScroll();
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("uploaded")) {
    showToast("Note uploaded successfully!", "success");
  }
  if (urlParams.has("liked")) {
    showToast("You liked this note!", "success");
  }
  if (urlParams.has("commented")) {
    showToast("Comment posted!", "success");
  }
  if (urlParams.has("deleted")) {
    showToast("Item deleted.", "info");
  }
  if (urlParams.has("error")) {
    showToast("Something went wrong. Please try again.", "error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
