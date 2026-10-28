
import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";

const API_URL = "http://localhost:5000/api";

function Home() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  
const [currentUser, setCurrentUser] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("ustaHubUser")) || null;
  } catch {
    return null;
  }
});


  useEffect(() => {
    async function fetchData() {
      try {
        const [categoryResponse, serviceResponse] = await Promise.all([
          axios.get(`${API_URL}/categories`),
          axios.get(`${API_URL}/services`),
        ]);

        setCategories(
          Array.isArray(categoryResponse.data)
            ? categoryResponse.data
            : categoryResponse.data.categories || []
        );

        setServices(
          Array.isArray(serviceResponse.data)
            ? serviceResponse.data
            : serviceResponse.data.services || []
        );
      } catch (err) {
        console.error("Failed to load homepage data:", err);
        setError(
          "Could not load services. Please check that your backend is running."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredServices = services.filter((service) => {
    const searchText = search.toLowerCase();

    return (
      (service.name || "").toLowerCase().includes(searchText) ||
      (service.description || "").toLowerCase().includes(searchText) ||
      (service.category || service.category_name || "")
        .toLowerCase()
        .includes(searchText)
    );
  });

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
      return "Price on request";
    }

    return `${new Intl.NumberFormat("en-US").format(Number(price))} UZS`;
  };

  const categoryIcons = [
    "🧹", "🔧", "⚡", "🛠️", "💇", "📸",
  ];

  return (
    <div className="app">
      <header className="navbar">
        <a className="logo" href="#">
          Usta<span>Hub</span>
        </a>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#categories">Categories</a>
          <a href="#services">Services</a>
        </nav>

        
<div className="nav-actions">
  {currentUser ? (
    <>
      <span className="welcome-user">
        Hi, {currentUser.name || currentUser.email}
      </span>

      <button
        className="login-button"
        onClick={() => {
          localStorage.removeItem("ustaHubToken");
          localStorage.removeItem("ustaHubUser");
          setCurrentUser(null);
        }}
      >
        Log out
      </button>
    </>
  ) : (
    <>
      <button
        className="login-button"
        onClick={() => (window.location.href = "/login")}
      >
        Log in
      </button>

      <button
        className="signup-button"
        onClick={() => (window.location.href = "/register")}
      >
        Get started
      </button>
    </>
  )}
</div>

      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="eyebrow">YOUR HOME, OUR PRIORITY</span>

            <h1>
              Find trusted help
              <br />
              for your <span>everyday needs.</span>
            </h1>

            <p>
              Discover local professionals for home repairs, cleaning,
              maintenance, and more — all in one place.
            </p>

            <div className="search-bar">
              <span>⌕</span>
              <input
                type="text"
                placeholder="What service do you need?"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                onClick={() =>
                  document
                    .getElementById("services")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Find a service
              </button>
            </div>

            <div className="hero-note">
              <span>✓</span> Local services made simple
              <span className="note-divider">·</span>
              <span>✓</span> Convenient booking
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-circle">
              <div className="hero-emoji">🧰</div>
            </div>

            <div className="floating-card card-top">
              <span className="floating-icon">✓</span>
              <div>
                <strong>Trusted professionals</strong>
                <small>Help when you need it</small>
              </div>
            </div>

            <div className="floating-card card-bottom">
              <span className="floating-icon">⌂</span>
              <div>
                <strong>Your home, taken care of</strong>
                <small>Explore services near you</small>
              </div>
            </div>
          </div>
        </section>

        <section className="categories-section" id="categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORE</span>
              <h2>What do you need help with?</h2>
              <p>Find the right professional for the job.</p>
            </div>
          </div>

          {loading ? (
            <p className="status-message">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="status-message">
              No categories found. Check your backend data.
            </p>
          ) : (
            <div className="category-grid">
              {categories.map((category, index) => (
                <button
                  className="category-card"
                  key={category.id}
                  onClick={() => {
                    setSearch(category.name || "");
                    document
                      .getElementById("services")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span className="category-icon">
                    {categoryIcons[index % categoryIcons.length]}
                  </span>
                  <strong>
                    {category.name || category.name_en || "Service"}
                  </strong>
                  <span className="category-arrow">↗</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="services-section" id="services">
          <div className="section-heading">
            <div>
              <span className="eyebrow">OUR SERVICES</span>
              <h2>Popular services</h2>
              <p>Explore available services and their starting prices.</p>
            </div>

            <span className="service-count">
              {services.length} services
            </span>
          </div>

          {loading ? (
            <p className="status-message">Loading services...</p>
          ) : error ? (
            <p className="error-message">{error}</p>
          ) : filteredServices.length === 0 ? (
            <p className="status-message">
              No matching services found. Try another search.
            </p>
          ) : (
            <div className="service-grid">
              {filteredServices.map((service, index) => (
                <article className="service-card" key={service.id}>
                  <div className={`service-art art-${index % 4}`}>
                    <span>
                      {categoryIcons[index % categoryIcons.length]}
                    </span>
                    <span className="art-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="service-details">
                    <span className="service-category">
                      {service.category ||
                        service.category_name ||
                        "Professional service"}
                    </span>

                    <h3>{service.name || "Unnamed service"}</h3>

                    <p>
                      {service.description ||
                        "Professional help for your everyday needs."}
                    </p>

                    <div className="service-footer">
                      <div>
                        <small>Starting from</small>
                        <strong>
                          {formatPrice(
                            service.base_price ?? service.price
                          )}
                        </strong>
                      </div>

                      <button
                        className="book-button"
                        onClick={() =>
                          alert("Booking functionality is coming next!")
                        }
                      >
                        Book <span>↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="cta-section">
          <div>
            <span className="eyebrow">ARE YOU A PROFESSIONAL?</span>
            <h2>Turn your skills into opportunities.</h2>
            <p>Connect with customers looking for your services.</p>
          </div>

          <button
            className="cta-button"
            onClick={() => alert("Provider registration is coming next!")}
          >
            Become a provider ↗
          </button>
        </section>
      </main>

      <footer className="footer">
        <a className="logo" href="#home">
          Usta<span>Hub</span>
        </a>
        <p>Connecting people with trusted local services.</p>
        <span>© {new Date().getFullYear()} Usta Hub</span>
      </footer>
    </div>
  );
}
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


