import React, { useState, useEffect, createContext, useContext } from 'react';
import { Heart, Clock, Search, Home, BarChart3, User, LogOut, Star, Users, Film, Eye, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

// ============= TMDB API CONFIGURATION =============
const TMDB_API_KEY = '1bc99f4e97b80cf35c10fad2f122d658'; // Replace with your actual API key
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// ============= CONTEXT & ROUTING =============
const AuthContext = createContext(null);
const RouterContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const Router = ({ children }) => {
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');
  
  useEffect(() => {
    const handleHashChange = () => setCurrentPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter must be used within Router');
  return context;
};

// ============= TMDB API SERVICE =============
const tmdbApi = {
  async fetchPopularMovies() {
    const response = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
    const data = await response.json();
    return data.results.slice(0, 20);
  },

  async fetchTrendingMovies() {
    const response = await fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.results.slice(0, 12);
  },

  async fetchMovieDetails(movieId) {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
    return await response.json();
  },

  async searchMovies(query) {
    const response = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.results;
  }
};

// ============= DATA API =============
const api = {
  currentUser: null,
  users: [],
  movies: [],
  reviews: [],
  
  initialize() {
    const stored = localStorage.getItem('cinesense-data');
    if (stored) {
      const data = JSON.parse(stored);
      this.users = data.users || [];
      this.reviews = data.reviews || [];
    } else {
      this.seedUsers();
    }
  },

  async loadMoviesFromTMDB() {
    try {
      const popularMovies = await tmdbApi.fetchPopularMovies();
      this.movies = popularMovies.map(movie => ({
        id: movie.id,
        title: movie.title,
        poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image',
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        rating: movie.vote_average,
        voteCount: movie.vote_count,
        overview: movie.overview,
        popularity: movie.popularity,
        releaseDate: movie.release_date,
        watchers: Math.floor(movie.vote_count / 10),
        avgRating: movie.vote_average / 2
      }));
      return this.movies;
    } catch (error) {
      console.error('Error loading movies:', error);
      return [];
    }
  },

  seedUsers() {
    this.users = [
      { id: 1, username: 'Diwakar_Subair', email: 'diwakar@cinesense.com', password: 'demo123', avatar: 'https://i.pravatar.cc/150?img=33', watchlist: [], favorites: [], following: [2, 3] },
      { id: 2, username: 'Eliza', email: 'eliza@cinesense.com', password: 'demo123', avatar: 'https://i.pravatar.cc/150?img=1', watchlist: [], favorites: [], following: [1] },
      { id: 3, username: 'Chris', email: 'chris@cinesense.com', password: 'demo123', avatar: 'https://i.pravatar.cc/150?img=12', watchlist: [], favorites: [], following: [1, 2] },
      { id: 4, username: 'Meena', email: 'meena@cinesense.com', password: 'demo123', avatar: 'https://i.pravatar.cc/150?img=5', watchlist: [], favorites: [], following: [] }
    ];
    this.saveData();
  },

  saveData() {
    localStorage.setItem('cinesense-data', JSON.stringify({
      users: this.users,
      reviews: this.reviews
    }));
  },

  login(email, password) {
    const user = this.users.find(u => u.email === email && u.password === password);
    if (user) {
      this.currentUser = user;
      localStorage.setItem('current-user', JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, error: 'Invalid credentials' };
  },

  signup(username, email, password) {
    if (this.users.find(u => u.email === email)) {
      return { success: false, error: 'Email already exists' };
    }
    const newUser = {
      id: this.users.length + 1,
      username,
      email,
      password,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
      watchlist: [],
      favorites: [],
      following: []
    };
    this.users.push(newUser);
    this.saveData();
    this.currentUser = newUser;
    localStorage.setItem('current-user', JSON.stringify(newUser));
    return { success: true, user: newUser };
  },

  getCurrentUser() {
    if (this.currentUser) return this.currentUser;
    const stored = localStorage.getItem('current-user');
    if (stored) {
      this.currentUser = JSON.parse(stored);
      const freshUser = this.users.find(u => u.id === this.currentUser.id);
      if (freshUser) {
        this.currentUser = freshUser;
        localStorage.setItem('current-user', JSON.stringify(freshUser));
      }
      return this.currentUser;
    }
    return null;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('current-user');
  },

  addReview(movieId, rating, text) {
    const review = {
      id: this.reviews.length + 1,
      userId: this.currentUser.id,
      movieId,
      rating,
      text,
      timestamp: Date.now()
    };
    this.reviews.unshift(review);
    this.saveData();
    return review;
  },

  toggleWatchlist(movieId) {
    const index = this.currentUser.watchlist.indexOf(movieId);
    if (index > -1) {
      this.currentUser.watchlist.splice(index, 1);
    } else {
      this.currentUser.watchlist.push(movieId);
    }
    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    this.users[userIndex] = this.currentUser;
    this.saveData();
    localStorage.setItem('current-user', JSON.stringify(this.currentUser));
  },

  toggleFavorite(movieId) {
    const index = this.currentUser.favorites.indexOf(movieId);
    if (index > -1) {
      this.currentUser.favorites.splice(index, 1);
    } else {
      this.currentUser.favorites.push(movieId);
    }
    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    this.users[userIndex] = this.currentUser;
    this.saveData();
    localStorage.setItem('current-user', JSON.stringify(this.currentUser));
  },

  searchUsers(query) {
    return this.users.filter(u => 
      u.username.toLowerCase().includes(query.toLowerCase()) && 
      u.id !== this.currentUser.id
    );
  },

  toggleFollow(userId) {
    const index = this.currentUser.following.indexOf(userId);
    if (index > -1) {
      this.currentUser.following.splice(index, 1);
    } else {
      this.currentUser.following.push(userId);
    }
    const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
    this.users[userIndex] = this.currentUser;
    this.saveData();
    localStorage.setItem('current-user', JSON.stringify(this.currentUser));
  },

  getUser(userId) {
    return this.users.find(u => u.id === userId);
  },

  getMovie(movieId) {
    return this.movies.find(m => m.id === movieId);
  },

  getReviewsForMovie(movieId) {
    return this.reviews.filter(r => r.movieId === movieId).map(r => ({
      ...r,
      user: this.users.find(u => u.id === r.userId)
    }));
  },

  getUserReviews(userId) {
    return this.reviews.filter(r => r.userId === userId).map(r => ({
      ...r,
      movie: this.movies.find(m => m.id === r.movieId)
    }));
  },
  getPersonalDashboardStats(userId) {
    const userReviews = this.getUserReviews(userId);

    // 1. Real Rating Distribution
    const ratingDistribution = [
      { name: '1★', value: 0, fill: '#EF4444' },
      { name: '2★', value: 0, fill: '#F59E0B' },
      { name: '3★', value: 0, fill: '#EAB308' },
      { name: '4★', value: 0, fill: '#84CC16' },
      { name: '5★', value: 0, fill: '#22C55E' }
    ];
    let totalRating = 0;
    userReviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating - 1].value++;
      }
      totalRating += r.rating;
    });
    
    const avgUserRating = userReviews.length > 0 
      ? (totalRating / userReviews.length).toFixed(1)
      : 0;

    // 2. Mock Genre Distribution (since we don't store all movie genres)
    // This creates a plausible distribution based on your review count
    const totalReviews = userReviews.length;
    const mockGenreData = [
      { name: 'Action', value: Math.max(1, Math.round(totalReviews * (Math.random() * 0.2 + 0.2))) },
      { name: 'Comedy', value: Math.max(1, Math.round(totalReviews * (Math.random() * 0.1 + 0.1))) },
      { name: 'Drama', value: Math.max(1, Math.round(totalReviews * (Math.random() * 0.2 + 0.2))) },
      { name: 'Sci-Fi', value: Math.max(1, Math.round(totalReviews * (Math.random() * 0.1 + 0.15))) },
      { name: 'Other', value: Math.max(1, Math.round(totalReviews * (Math.random() * 0.1 + 0.05))) },
    ];

    return {
      totalUserReviews: userReviews.length,
      avgUserRating,
      ratingDistribution,
      genreDistribution: mockGenreData,
    };
  },

  getDashboardStats () {
    const reviewsByMovie = {};
    this.reviews.forEach(r => {
      if (!reviewsByMovie[r.movieId]) {
        reviewsByMovie[r.movieId] = { count: 0, totalRating: 0 };
      }
      reviewsByMovie[r.movieId].count++;
      reviewsByMovie[r.movieId].totalRating += r.rating;
    });

    const movieStats = this.movies.map(movie => ({
      ...movie,
      reviewCount: reviewsByMovie[movie.id]?.count || 0,
      avgUserRating: reviewsByMovie[movie.id] 
        ? (reviewsByMovie[movie.id].totalRating / reviewsByMovie[movie.id].count).toFixed(1)
        : 0
    })).sort((a, b) => b.reviewCount - a.reviewCount);

    const ratingDistribution = [0, 0, 0, 0, 0];
    this.reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating - 1]++;
      }
    });

    const monthlyReviews = Array(12).fill(0);
    this.reviews.forEach(r => {
      const month = new Date(r.timestamp).getMonth();
      monthlyReviews[month]++;
    });

    return {
      totalUsers: this.users.length,
      totalReviews: this.reviews.length,
      totalMovies: this.movies.length,
      avgRating: this.reviews.length > 0 
        ? (this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length).toFixed(1)
        : 0,
      movieStats,
      ratingDistribution,
      monthlyReviews
    };
  }
  

};

// ============= COMPONENTS =============

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const result = isLogin 
      ? api.login(email, password)
      : api.signup(username, email, password);

    if (result.success) {
      login(result.user);
    } else {
      setError(result.error);
    }
  };

  return (
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <Film style={styles.authIcon} />
        <h1 style={styles.authTitle}>Cine-Sense</h1>
        <p style={styles.authSubtitle}>Your social film diary</p>

        <div style={styles.authToggle}>
          <button
            onClick={() => setIsLogin(true)}
            style={{...styles.toggleBtn, ...(isLogin ? styles.toggleBtnActive : {})}}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{...styles.toggleBtn, ...(!isLogin ? styles.toggleBtnActive : {})}}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.authForm}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.authInput}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.authInput}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.authInput}
            required
          />
          
          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.authSubmit}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={styles.authDemo}>
          <p>Demo: diwakar@cinesense.com / demo123</p>
        </div>
      </div>
    </div>
  );
};

const MovieCard = ({ movie, onAction }) => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [showActions, setShowActions] = useState(false);

  const isInWatchlist = user?.watchlist?.includes(movie.id);
  const isFavorite = user?.favorites?.includes(movie.id);

  return (
    <div 
      style={styles.movieCard}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => navigate(`/movie/${movie.id}`)}
    >
      <img 
        src={movie.poster} 
        alt={movie.title}
        style={styles.moviePoster}
      />
      
      {showActions && (
        <div style={styles.movieOverlay}>
          <div style={styles.movieInfo}>
            <h4 style={styles.movieTitle}>{movie.title}</h4>
            <div style={styles.movieMeta}>
              <Star size={14} fill="#FFC700" color="#FFC700" />
              <span>{movie.avgRating ? movie.avgRating.toFixed(1) : 'N/A'}</span>
            </div>
          </div>
          <div style={styles.movieActions}>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('review', movie); }}
              style={styles.actionBtn}
              title="Review"
            >
              <Eye size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('favorite', movie); }}
              style={{...styles.actionBtn, ...(isFavorite ? styles.actionBtnActive : {})}}
              title="Favorite"
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('watchlist', movie); }}
              style={{...styles.actionBtn, ...(isInWatchlist ? styles.actionBtnActive : {})}}
              title="Watchlist"
            >
              <Clock size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ReviewModal = ({ movie, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (rating > 0 && text) {
      onSubmit(movie.id, rating, text);
      onClose();
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Review {movie.title}</h3>
        
        <div style={styles.modalSection}>
          <label style={styles.modalLabel}>Rating</label>
          <div style={styles.starRating}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={32}
                fill={star <= rating ? '#FFC700' : 'none'}
                color={star <= rating ? '#FFC700' : '#666'}
                onClick={() => setRating(star)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </div>
        </div>

        <div style={styles.modalSection}>
          <label style={styles.modalLabel}>Your Review</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={styles.modalTextarea}
            placeholder="What did you think?"
          />
        </div>

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.modalBtnCancel}>
            Cancel
          </button>
          <button onClick={handleSubmit} style={styles.modalBtnSubmit}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

const NavBar = () => {
  const { user, logout } = useAuth();
  const { navigate, currentPath } = useRouter();

  return (
    <nav style={styles.nav}>
      <div style={styles.navContent}>
        <div style={styles.navLeft}>
          <div style={styles.navLogo} onClick={() => navigate('/')}>
            <Film size={32} color="#FFC700" />
            <span style={styles.navLogoText}>Cine-Sense</span>
          </div>
          
          <div style={styles.navLinks}>
            <button
              onClick={() => navigate('/')}
              style={{...styles.navLink, ...(currentPath === '/' ? styles.navLinkActive : {})}}
            >
              <Home size={18} />
              <span>Home</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{...styles.navLink, ...(currentPath === '/dashboard' ? styles.navLinkActive : {})}}
            >
              <BarChart3 size={18} />
              <span>Dashboard</span>
            </button>
            {/* --- NEW "MY STATS" BUTTON --- */}
            <button
              onClick={() => navigate('/personal-stats')}
              style={{...styles.navLink, ...(currentPath === '/personal-stats' ? styles.navLinkActive : {})}}
            >
              <User size={18} />
              <span>My Stats</span>
            </button>
            {/* --- END NEW BUTTON --- */}
            <button
              onClick={() => navigate('/friends')}
              style={{...styles.navLink, ...(currentPath === '/friends' ? styles.navLinkActive : {})}}
            >
              <Users size={18} />
              <span>Friends</span>
            </button>
          </div>
        </div>

        <div style={styles.navRight}>
          <button
            onClick={() => navigate(`/profile/${user.id}`)}
        _     style={styles.navProfile}
          >
            <img src={user.avatar} alt={user.username} style={styles.navAvatar} />
            <span>{user.username}</span>
          </button>
          <button onClick={logout} style={styles.navLogout} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
    _ </div>
    </nav>
  );
};

const HomePage = () => {
  const { user } = useAuth();
  const [movies, setMovies] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true); // For initial page load
  const [selectedMovie, setSelectedMovie] = useState(null);

  // --- NEW STATE FOR SEARCH ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  // --- END NEW STATE ---

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    setLoading(true);
    await api.loadMoviesFromTMDB();
    const trendingData = await tmdbApi.fetchTrendingMovies();
    setMovies(api.movies);
    setTrending(trendingData.map(m => ({
      ...m,
      poster: `${TMDB_IMAGE_BASE}${m.poster_path}`,
      avgRating: m.vote_average / 2,
      id: m.id
    })));
    setLoading(false);
  };

  // --- NEW SEARCH HANDLER ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await tmdbApi.searchMovies(searchQuery);
      const processedResults = results.map(movie => ({
        id: movie.id,
        title: movie.title,
        poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image',
        backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A',
        rating: movie.vote_average,
        voteCount: movie.vote_count,
        overview: movie.overview,
        popularity: movie.popularity,
        releaseDate: movie.release_date,
        watchers: Math.floor(movie.vote_count / 10),
        avgRating: movie.vote_average / 2
      }));
      setSearchResults(processedResults);
    } catch (error) {
      console.error('Error searching movies:', error);
      setSearchResults([]);
    }
    setIsSearching(false);
  };
  // --- END NEW SEARCH HANDLER ---

  const handleAction = (action, movie) => {
    if (action === 'review') {
      setSelectedMovie(movie);
    } else if (action === 'favorite') {
      api.toggleFavorite(movie.id);
    } else if (action === 'watchlist') {
      api.toggleWatchlist(movie.id);
    }
  };

  const handleReviewSubmit = (movieId, rating, text) => {
    api.addReview(movieId, rating, text);
  };

  const favoriteMovies = movies.filter(m => user.favorites.includes(m.id));

  if (loading) {
    return <div style={styles.loading}>Loading movies from TMDB...</div>;
  }

  return (
    <div style={styles.container}>
      
      {/* --- NEW SEARCH BAR --- */}
      <div style={{...styles.searchBar, marginBottom: '2rem'}}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search all movies on TMDB..."
          style={styles.searchInput}
        />
        <button onClick={handleSearch} style={styles.searchBtn}>
          <Search size={20} />
        </button>
      </div>
      {/* --- END SEARCH BAR --- */}

      {/* --- NEW SEARCH RESULTS SECTION --- */}
      {hasSearched && (
        <section style={styles.section}>
          <h2 style={styles.sectionHeading}>Search Results ({searchResults.length})</h2>
          {isSearching ? (
            <div style={styles.loading}>Searching...</div>
          ) : searchResults.length === 0 ? (
            <p style={styles.emptyText}>No movies found for "{searchQuery}".</p>
          ) : (
            <div style={styles.movieGrid}>
              {searchResults.map(movie => (
                <MovieCard key={movie.id} movie={movie} onAction={handleAction} />
              ))}
            </div>
          )}
        </section>
      )}
      {/* --- END SEARCH RESULTS SECTION --- */}

      <div style={styles.profileSection}>
        <div style={styles.profileHeader}>
          <img src={user.avatar} alt={user.username} style={styles.profileAvatar} />
          <div>
            <h2 style={styles.profileName}>{user.username}</h2>
            <div style={styles.profileStats}>
              <div style={styles.statItem}>
                <div style={styles.statNumber}>{api.getUserReviews(user.id).length}</div>
                <div style={styles.statLabel}>Reviews</div>
              </div>
        _       <div style={styles.statItem}>
                <div style={styles.statNumber}>{user.watchlist.length}</div>
                <div style={styles.statLabel}>Watchlist</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statNumber}>{user.following.length}</div>
                <div style={styles.statLabel}>Following</div>
              </div>
            </div>
          </div>
        </div>

        {favoriteMovies.length > 0 && (
          <>
            <h3 style={styles.sectionTitle}>Favorite Films</h3>
            <div style={styles.movieGrid}>
              {favoriteMovies.slice(0, 4).map(movie => (
                <MovieCard key={movie.id} movie={movie} onAction={handleAction} />
              ))}
            </div>
          </>
        )}
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Trending This Week</h2>
        <div style={styles.movieGrid}>
          {trending.slice(0, 6).map(movie => (
            <MovieCard key={movie.id} movie={movie} onAction={handleAction} />
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Popular Movies</h2>
        <div style={styles.movieGrid}>
          {movies.slice(0, 12).map(movie => (
            <MovieCard key={movie.id} movie={movie} onAction={handleAction} />
          ))}
        </div>
      </section>

      {selectedMovie && (
        <ReviewModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
};
const DashboardPage = () => {
  const stats = api.getDashboardStats();
  const [selectedMovie, setSelectedMovie] = useState('Vikram (2022)');

  // --- Mock Data for the new charts ---
  const audienceDemographics = [
    { name: '18-24', value: 300, fill: '#FFC700' },
    { name: '25-34', value: 450, fill: '#FFA000' },
    { name: '35-44', value: 400, fill: '#FF7C00' },
    { name: '45+', value: 200, fill: '#FF5400' },
  ];

  // Get top 5 movies for the bar chart
  const topMovies = stats.movieStats.slice(0, 5).map(m => ({
    name: m.title.length > 15 ? m.title.substring(0, 15) + '...' : m.title,
    'reviews': m.reviewCount,
    // Create a dynamic title for the trend chart
    trendTitle: `${m.title} (${m.year})`
  })).reverse(); // reverse for horizontal bar chart
  
  const movieTrendOptions = topMovies.map(m => m.trendTitle);
  if (!movieTrendOptions.includes(selectedMovie)) {
    setSelectedMovie(movieTrendOptions[0] || 'Vikram (2022)');
  }
  
  const mockViewershipData = {
    [movieTrendOptions[0]]: [
      { date: 'Oct \'24', views: 3500 }, { date: 'Nov \'24', views: 3000 }, { date: 'Dec \'24', views: 2500 },
      { date: 'Jan \'25', views: 4000 }, { date: 'Feb \'25', views: 5500 }, { date: 'Mar \'25', views: 3000 },
      { date: 'Apr \'25', views: 3500 }, { date: 'May \'25', views: 4200 }, { date: 'Jun \'25', views: 4000 },
      { date: 'Jul \'25', views: 2500 }, { date: 'Aug \'25', views: 3000 }, { date: 'Sep \'25', views: 3800 },
    ],
    [movieTrendOptions[1]]: [
      { date: 'Oct \'24', views: 2000 }, { date: 'Nov \'24', views: 2200 }, { date: 'Dec \'24', views: 2800 },
      { date: 'Jan \'25', views: 3500 }, { date: 'Feb \'25', views: 3000 }, { date: 'Mar \'25', views: 4000 },
      { date: 'Apr \'25', views: 4100 }, { date: 'May \'25', views: 3800 }, { date: 'Jun \'25', views: 3500 },
      { date: 'Jul \'25', views: 3000 }, { date: 'Aug \'25', views: 2800 }, { date: 'Sep \'25', views: 3200 },
    ],
    [movieTrendOptions[2]]: [
      { date: 'Oct \'24', views: 1000 }, { date: 'Nov \'24', views: 1500 }, { date: 'Dec \'24', views: 2000 },
      { date: 'Jan \'25', views: 2500 }, { date: 'Feb \'25', views: 3000 }, { date: 'Mar \'25', views: 3500 },
      { date: 'Apr \'25', views: 3000 }, { date: 'May \'25', views: 2800 }, { date: 'Jun \'25', views: 2500 },
      { date: 'Jul \'25', views: 2000 }, { date: 'Aug \'25', views: 2200 }, { date: 'Sep \'25', views: 2500 },
    ],
    [movieTrendOptions[3]]: [
      { date: 'Oct \'24', views: 4000 }, { date: 'Nov \'24', views: 4200 }, { date: 'Dec \'24', views: 4800 },
      { date: 'Jan \'25', views: 4500 }, { date: 'Feb \'25', views: 4000 }, { date: 'Mar \'25', views: 3000 },
      { date: 'Apr \'25', views: 3100 }, { date: 'May \'25', views: 3800 }, { date: 'Jun \'25', views: 3500 },
      { date: 'Jul \'25', views: 3000 }, { date: 'Aug \'25', views: 2800 }, { date: 'Sep \'25', views: 3200 },
    ],
    [movieTrendOptions[4]]: [
      { date: 'Oct \'24', views: 500 }, { date: 'Nov \'24', views: 800 }, { date: 'Dec \'24', views: 1200 },
      { date: 'Jan \'25', views: 1500 }, { date: 'Feb \'25', views: 1800 }, { date: 'Mar \'25', views: 2000 },
      { date: 'Apr \'25', views: 2100 }, { date: 'May \'25', views: 2500 }, { date: 'Jun \'25', views: 2300 },
      { date: 'Jul \'25', views: 2000 }, { date: 'Aug \'25', views: 1800 }, { date: 'Sep \'25', views: 1900 },
    ],
    'Vikram (2022)': [ // Fallback
      { date: 'Oct \'24', views: 3500 }, { date: 'Nov \'24', views: 3000 }, { date: 'Dec \'24', views: 2500 },
      { date: 'Jan \'25', views: 4000 }, { date: 'Feb \'25', views: 5500 }, { date: 'Mar \'25', views: 3000 },
      { date: 'Apr \'25', views: 3500 }, { date: 'May \'25', views: 4200 }, { date: 'Jun \'25', views: 4000 },
      { date: 'Jul \'25', views: 2500 }, { date: 'Aug \'25', views: 3000 }, { date: 'Sep \'25', views: 3800 },
    ]
  };
  // --- End of Mock Data ---

  return (
    <div style={styles.container}>
      <h1 style={styles.dashTitle}>BI DASHBOARD</h1>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <Users size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>{stats.totalUsers}</div>
          <div style={styles.kpiLabel}>Total Users</div>
        </div>
        <div style={styles.kpiCard}>
          <Star size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>{stats.totalReviews}</div>
          <div style={styles.kpiLabel}>Total Reviews</div>
        </div>
        <div style={styles.kpiCard}>
          <TrendingUp size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>{stats.avgRating} ★</div>
          <div style={styles.kpiLabel}>Avg Rating</div>
        </div>
        <div style={styles.kpiCard}>
          <BarChart3 size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>28%</div>
          <div style={styles.kpiLabel}>Weekly Growth</div>
        </div>
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>MOST LOGGED FILMS</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMovies} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#999" />
              <YAxis type="category" dataKey="name" stroke="#999" width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Bar dataKey="reviews" fill="#FFC700" name="Reviews" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>AUDIENCE DEMOGRAPHICS</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={audienceDemographics}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={(entry) => `${entry.name} (${entry.value})`}
              >
          _         {audienceDemographics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={styles.chartCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={styles.chartTitle}>MOVIE VIEWERSHIP TREND</h3>
          <select 
            value={selectedMovie} 
            onChange={(e) => setSelectedMovie(e.target.value)}
            style={styles.authInput} // Re-using auth input style
          >
            {movieTrendOptions.map(title => <option key={title} value={title}>{title}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={mockViewershipData[selectedMovie]}>
            <defs>
              <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFC700" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#FFC700" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#999" />
            <YAxis stroke="#999" />
      _       <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
            <Area 
              type="monotone" 
              dataKey="views" 
              stroke="#FFC700" 
              fillOpacity={1} 
              fill="url(#colorViews)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const FriendsPage = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const following = api.users.filter(u => user.following.includes(u.id));

  const handleSearch = () => {
    if (searchQuery.trim()) {
      const results = api.searchUsers(searchQuery);
      setSearchResults(results);
    }
  };

  const handleFollow = (userId) => {
    api.toggleFollow(userId);
    if (searchQuery.trim()) {
      setSearchResults(api.searchUsers(searchQuery));
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Find Friends</h1>
      <div style={styles.searchBar}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search users..."
          style={styles.searchInput}
        />
        <button onClick={handleSearch} style={styles.searchBtn}>
          <Search size={20} />
        </button>
      </div>

      {searchResults.length > 0 && (
        <div style={styles.friendsSection}>
          <h2 style={styles.sectionTitle}>Search Results</h2>
          {searchResults.map(u => (
            <div key={u.id} style={styles.friendItem}>
              <div style={styles.friendInfo} onClick={() => navigate(`/profile/${u.id}`)}>
                <img src={u.avatar} alt={u.username} style={styles.friendAvatar} />
                <div>
                  <div style={styles.friendName}>{u.username}</div>
                  <div style={styles.friendEmail}>{u.email}</div>
                </div>
              </div>
              <button
                onClick={() => handleFollow(u.id)}
                style={user.following.includes(u.id) ? styles.btnUnfollow : styles.btnFollow}
              >
                {user.following.includes(u.id) ? 'Unfollow' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.friendsSection}>
        <h2 style={styles.sectionTitle}>Following ({following.length})</h2>
        {following.length === 0 ? (
          <p style={styles.emptyText}>You're not following anyone yet.</p>
        ) : (
          following.map(u => (
            <div key={u.id} style={styles.friendItem}>
              <div style={styles.friendInfo} onClick={() => navigate(`/profile/${u.id}`)}>
                <img src={u.avatar} alt={u.username} style={styles.friendAvatar} />
                <div>
                  <div style={styles.friendName}>{u.username}</div>
                  <div style={styles.friendEmail}>{api.getUserReviews(u.id).length} reviews</div>
                </div>
              </div>
              <button onClick={() => handleFollow(u.id)} style={styles.btnUnfollow}>
                Unfollow
              </button>
            </div>
          ))
        )}
      </div>
_   </div>
  );
};
// --- PASTE THIS ENTIRE NEW COMPONENT ---

const PersonalDashboardPage = () => {
  const { user } = useAuth();
  const stats = api.getPersonalDashboardStats(user.id);

  return (
    <div style={styles.container}>
      <h1 style={styles.dashTitle}>My Personal Dashboard</h1>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <Star size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>{stats.totalUserReviews}</div>
          <div style={styles.kpiLabel}>Total Reviews</div>
        </div>
        <div style={styles.kpiCard}>
          <TrendingUp size={32} color="#FFC700" />
          <div style={styles.kpiNumber}>{stats.avgUserRating} ★</div>
          <div style={styles.kpiLabel}>My Avg Rating</div>
        </div>
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>My Rating Distribution</h3>
          {stats.totalUserReviews === 0 ? (
            <p style={styles.emptyText}>Review some movies to see your stats!</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.ratingDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {stats.ratingDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>My Genre Distribution (Mock)</h3>
          {stats.totalUserReviews === 0 ? (
            <p style={styles.emptyText}>Your reviewed genres will appear here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.genreDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
          _         outerRadius={80}
                  dataKey="value"
                  label={(entry) => `${entry.name} (${entry.value})`}
                >
                  <Cell key={`cell-0`} fill="#FFC700" />
                  <Cell key={`cell-1`} fill="#8B5CF6" />
                  <Cell key={`cell-2`} fill="#3B82F6" />
                  <Cell key={`cell-3`} fill="#EC4899" />
                  <Cell key={`cell-4`} fill="#6366F1" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { currentPath } = useRouter();
  const { user: currentUser } = useAuth();
  const userId = parseInt(currentPath.split('/')[2]);
  const user = api.getUser(userId);
  const userReviews = api.getUserReviews(userId);
  const isOwnProfile = currentUser.id === userId;

  if (!user) {
    return <div style={styles.emptyText}>User not found</div>;
  }

  const favoriteMovies = api.movies.filter(m => user.favorites.includes(m.id));

  return (
    <div style={styles.container}>
      <div style={styles.profileSection}>
        <div style={styles.profileHeaderLarge}>
          <img src={user.avatar} alt={user.username} style={styles.profileAvatarLarge} />
          <div style={{ flex: 1 }}>
            <h1 style={styles.profileNameLarge}>{user.username}</h1>
            <p style={styles.profileEmail}>{user.email}</p>
            <div style={styles.profileStats}>
              <div style={styles.statItem}>
                <div style={styles.statNumber}>{userReviews.length}</div>
                <div style={styles.statLabel}>Reviews</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statNumber}>{user.watchlist.length}</div>
                <div style={styles.statLabel}>Watchlist</div>
              </div>
              <div style={styles.statItem}>
                <div style={styles.statNumber}>{user.following.length}</div>
                <div style={styles.statLabel}>Following</div>
              </div>
            </div>
          </div>
          {!isOwnProfile && (
            <button
              onClick={() => api.toggleFollow(userId)}
              style={currentUser.following.includes(userId) ? styles.btnUnfollow : styles.btnFollow}
            >
              {currentUser.following.includes(userId) ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {favoriteMovies.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>Favorite Films</h2>
nbsp;       <div style={styles.movieGrid}>
            {favoriteMovies.map(movie => (
              <img key={movie.id} src={movie.poster} alt={movie.title} style={styles.moviePoster} />
            ))}
          </div>
        </div>
      )}

      <div style={styles.section}>
        <h2 style={styles.sectionHeading}>Reviews ({userReviews.length})</h2>
        {userReviews.length === 0 ? (
          <p style={styles.emptyText}>No reviews yet.</p>
        ) : (
          <div>
            {userReviews.map(review => (
              <div key={review.id} style={styles.reviewItem}>
                <img src={review.movie?.poster} alt={review.movie?.title} style={styles.reviewPoster} />
                <div style={{ flex: 1 }}>
                  <h3 style={styles.reviewTitle}>{review.movie?.title}</h3>
                  <div style={styles.reviewStars}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={16} fill={i < review.rating ? '#FFC700' : 'none'} color={i < review.rating ? '#FFC700' : '#666'} />
                    ))}
                  </div>
                  <p style={styles.reviewText}>"{review.text}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MovieDetailPage = () => {
  const { currentPath, navigate } = useRouter();
  const { user } = useAuth();
  const movieId = parseInt(currentPath.split('/')[2]);
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now()); // Hack to force re-render on action

  useEffect(() => {
    loadMovieDetails();
  }, [movieId]);

  const loadMovieDetails = async () => {
    setLoading(true);
    try {
      const details = await tmdbApi.fetchMovieDetails(movieId);
      const movieData = {
        id: details.id,
        title: details.title,
        poster: details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image',
        backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : 'https://via.placeholder.com/1280x720?text=No+Backdrop',
        year: details.release_date ? new Date(details.release_date).getFullYear() : 'N/A',
        rating: details.vote_average,
        voteCount: details.vote_count,
        overview: details.overview,
        releaseDate: details.release_date,
        runtime: details.runtime,
        tagline: details.tagline,
        genres: details.genres || [],
        cast: details.credits?.cast?.slice(0, 10) || [],
        avgRating: details.vote_average / 2
      };
      setMovie(movieData);

      // Ensure this movie exists in the global list for other components
      if (!api.getMovie(movieId)) {
        api.movies.push(movieData); 
      }

      const localReviews = api.getReviewsForMovie(movieId);
      setReviews(localReviews);
    } catch (error) {
      console.error('Error fetching movie details:', error);
      navigate('/'); // Go home if movie not found
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = (movieId, rating, text) => {
    api.addReview(movieId, rating, text);
    setReviews(api.getReviewsForMovie(movieId)); // Refresh reviews list
  };

  const handleToggleFavorite = () => {
    api.toggleFavorite(movie.id);
    setLastUpdated(Date.now()); // Force re-render
  };

  const handleToggleWatchlist = () => {
    api.toggleWatchlist(movie.id);
    setLastUpdated(Date.now()); // Force re-render
  };

  if (loading || !movie) {
    return <div style={styles.loading}>Loading movie details...</div>;
  }
  
  // We check the user from the api directly, as the context user might be stale
  const freshUser = api.getCurrentUser();
  const isFavorite = freshUser.favorites.includes(movie.id);
  const isInWatchlist = freshUser.watchlist.includes(movie.id);

  return (
    <div>
      <div style={{...styles.movieBackdrop, backgroundImage: `url(${movie.backdrop})`}}>
        <div style={styles.movieBackdropOverlay}>
          <div style={styles.movieHeader}>
            <img src={movie.poster} alt={movie.title} style={styles.movieDetailPoster} />
            <div style={styles.movieHeaderInfo}>
              <h1 style={styles.movieDetailTitle}>{movie.title} ({movie.year})</h1>
              <p style={styles.movieDetailTagline}>{movie.tagline}</p>
              <div style={styles.movieDetailMeta}>
                <span style={styles.movieDetailMetaItem}><Star size={16} color="#FFC700" fill="#FFC700" /> {movie.rating.toFixed(1)}</span>
                <span style={styles.movieDetailMetaItem}><Clock size={16} /> {movie.runtime} min</span>
                <span style={styles.movieDetailMetaItem}><Calendar size={16} /> {movie.releaseDate}</span>
              </div>
              <div style={styles.movieDetailActions}>
                <button onClick={() => setSelectedMovie(movie)} style={styles.movieDetailActionBtn}>
                  <Eye size={18} /> Review
                </button>
                <button onClick={handleToggleFavorite} style={{...styles.movieDetailActionBtn, ...(isFavorite ? styles.actionBtnActive : {})}}>
                  <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /> Favorite
                </button>
                <button onClick={handleToggleWatchlist} style={{...styles.movieDetailActionBtn, ...(isInWatchlist ? styles.actionBtnActive : {})}}>
                  <Clock size={18} /> Watchlist
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>Overview</h2>
          <p style={styles.movieDetailOverview}>{movie.overview}</p>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>Genres</h2>
          <div style={styles.genreTags}>
            {movie.genres.map(g => <span key={g.id} style={styles.genreTag}>{g.name}</span>)}
          </div>
        </div>
        
        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>Cast</h2>
          <div style={styles.castGrid}>
            {movie.cast.map(c => (
              <div key={c.cast_id} style={styles.castMember}>
                <img 
                  src={c.profile_path ? `${TMDB_IMAGE_BASE}${c.profile_path}` : 'https://via.placeholder.com/150x225?text=No+Photo'} 
                  alt={c.name}
                  style={styles.castMemberImg}
                />
                <strong style={styles.castMemberName}>{c.name}</strong>
                <span style={styles.castMemberChar}>{c.character}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionHeading}>Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p style={styles.emptyText}>No reviews yet. Be the first!</p>
          ) : (
            <div>
              {reviews.map(review => (
                <div key={review.id} style={styles.reviewItem}>
                  <img src={review.user.avatar} alt={review.user.username} style={styles.friendAvatar} />
                  <div style={{ flex: 1, marginLeft: '15px' }}>
                    <h3 style={styles.friendName}>{review.user.username}</h3>
                    <div style={styles.reviewStars}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill={i < review.rating ? '#FFC700' : 'none'} color={i < review.rating ? '#FFC700' : '#666'} />
                      ))}
                    </div>
                    <p style={styles.reviewText}>"{review.text}"</p>
                  </div>
                </div>
             ))}
            </div>
          )}
        </div>
      </div>

      {selectedMovie && (
        <ReviewModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
};

// ============= APP & STYLES =============

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(api.getCurrentUser());

  const login = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const AppContent = () => {
  const { user } = useAuth();
  const { currentPath } = useRouter();

  if (!user) {
    return <AuthPage />;
  }

  const renderPage = () => {
    if (currentPath === '/') return <HomePage />;
    if (currentPath === '/dashboard') return <DashboardPage />;
    // --- NEW ROUTE ---
    if (currentPath === '/personal-stats') return <PersonalDashboardPage />;
    // --- END NEW ROUTE ---
    if (currentPath === '/friends') return <FriendsPage />;
    if (currentPath.startsWith('/profile/')) return <ProfilePage />;
    if (currentPath.startsWith('/movie/')) return <MovieDetailPage />;
    return <HomePage />; // Default
  };

  return (
    <div style={styles.appLayout}>
      <NavBar />
      <main style={styles.mainContent}>
        {renderPage()}
      </main>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    api.initialize();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

const styles = {
  // App Layout
  appLayout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
    paddingTop: '60px', // NavBar height
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 'calc(100vh - 60px)',
    fontSize: '1.5rem',
    color: '#FFC700',
  },

  // Auth Page
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #121212 100%)',
  },
  authBox: {
    backgroundColor: '#1a1a1a',
    padding: '2.5rem',
    borderRadius: '8px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    width: '400px',
    textAlign: 'center',
    border: '1px solid #333',
  },
  authIcon: {
    width: '60px',
    height: '60px',
    color: '#FFC700',
    marginBottom: '1rem',
  },
  authTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '2rem',
    color: '#FFC700',
  },
  authSubtitle: {
    margin: '0 0 2rem 0',
    fontSize: '1rem',
    color: '#999',
  },
  authToggle: {
    display: 'flex',
    marginBottom: '1.5rem',
    border: '1px solid #333',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    padding: '0.75rem',
    background: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  toggleBtnActive: {
    background: '#FFC700',
    color: '#121212',
    fontWeight: 'bold',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  authInput: {
    padding: '0.75rem 1rem',
    background: '#222',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#FFF',
    fontSize: '1rem',
  },
  authSubmit: {
    padding: '0.75rem',
    background: '#FFC700',
    border: 'none',
    borderRadius: '4px',
    color: '#121212',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  error: {
    color: '#EF4444',
    background: 'rgba(239, 68, 68, 0.1)',
    padding: '0.5rem',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  authDemo: {
    marginTop: '1.5rem',
    fontSize: '0.9rem',
    color: '#777',
  },

  // NavBar
  nav: {
    width: '100%',
    height: '60px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 1000,
  },
  navContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem',
    height: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  navLogoText: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#FFC700',
  },
  navLinks: {
    display: 'flex',
    gap: '0.5rem',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '1rem',
  },
  navLinkActive: {
    background: '#333',
    color: '#FFC700',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  navProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: '#EEE',
    cursor: 'pointer',
  },
  navAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
  },
  navLogout: {
    background: 'transparent',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
  },

  // Movie Card
  movieCard: {
    position: 'relative',
    aspectRatio: '2 / 3',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: '#222',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  moviePoster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  movieOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.1) 60%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1rem',
    opacity: 1,
    transition: 'opacity 0.3s ease',
  },
  movieInfo: {
    alignSelf: 'flex-end',
    width: '100%',
  },
  movieTitle: {
    fontSize: '1.1rem',
    color: '#FFF',
    margin: '0 0 0.25rem 0',
  },
  movieMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    color: '#FFC700',
    fontSize: '0.9rem',
  },
  movieActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    alignSelf: 'flex-end',
  },
  actionBtn: {
    background: 'rgba(34, 34, 34, 0.8)',
    border: '1px solid #444',
    color: '#FFF',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  actionBtnActive: {
    color: '#FFC700',
    background: 'rgba(255, 199, 0, 0.1)',
    borderColor: '#FFC700',
  },

  // Review Modal
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  modalContent: {
    background: '#1a1a1a',
    padding: '2rem',
    borderRadius: '8px',
    width: '500px',
    border: '1px solid #333',
  },
  modalTitle: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.5rem',
  },
  modalSection: {
    marginBottom: '1.5rem',
  },
  modalLabel: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#999',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
  },
  starRating: {
    display: 'flex',
    gap: '0.5rem',
  },
  modalTextarea: {
    width: '100%',
    minHeight: '120px',
    background: '#222',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#FFF',
    fontSize: '1rem',
    padding: '0.75rem',
    resize: 'vertical',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
  },
  modalBtnCancel: {
    padding: '0.5rem 1.5rem',
    background: '#333',
    border: 'none',
    borderRadius: '4px',
    color: '#EEE',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  modalBtnSubmit: {
    padding: '0.5rem 1.5rem',
    background: '#FFC700',
    border: 'none',
    borderRadius: '4px',
    color: '#121212',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },

  // Home Page
  profileSection: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '2rem',
    marginBottom: '2rem',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '1.5rem',
  },
  profileAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
  },
  profileName: {
    margin: 0,
    fontSize: '1.75rem',
  },
  profileStats: {
    display: 'flex',
    gap: '2rem',
    marginTop: '0.5rem',
  },
  statItem: {
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#FFC700',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#999',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: '3rem',
  },
  sectionHeading: {
    fontSize: '1.75rem',
    color: '#FFC700',
    borderBottom: '2px solid #FFC700',
    paddingBottom: '0.5rem',
    marginBottom: '1.5rem',
  },
  movieGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1.5rem',
  },

  // Dashboard Page
  dashTitle: {
    fontSize: '2.5rem',
    color: '#FFC700',
    marginBottom: '2rem',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  kpiCard: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  kpiNumber: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#FFC700',
    marginTop: '0.5rem',
  },
  kpiLabel: {
    fontSize: '1rem',
    color: '#999',
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  chartCard: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem',
  },
  chartTitle: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.25rem',
    color: '#EEE',
  },

  // Friends Page
  pageTitle: {
    fontSize: '2.5rem',
    color: '#FFC700',
    marginBottom: '2rem',
  },
  searchBar: {
    display: 'flex',
    marginBottom: '2rem',
  },
  searchInput: {
    flex: 1,
    padding: '0.75rem 1.5rem',
    background: '#222',
    border: '1px solid #444',
    borderRight: 'none',
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
    color: '#FFF',
    fontSize: '1rem',
  },
  searchBtn: {
    padding: '0 1.5rem',
    background: '#FFC700',
    border: '1px solid #FFC700',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
    color: '#121212',
    cursor: 'pointer',
  },
  friendsSection: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '2rem',
  },
  friendItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #333',
  },
  friendInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    cursor: 'pointer',
  },
  friendAvatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
  },
  friendName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#EEE',
  },
  friendEmail: {
    fontSize: '0.9rem',
    color: '#999',
  },
  btnFollow: {
    padding: '0.5rem 1.5rem',
    background: '#FFC700',
    border: 'none',
    borderRadius: '4px',
    color: '#121212',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  btnUnfollow: {
    padding: '0.5rem 1.5rem',
    background: 'transparent',
    border: '1px solid #666',
    borderRadius: '4px',
    color: '#AAA',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    padding: '1rem',
    textAlign: 'center',
  },

  // Profile Page
  profileHeaderLarge: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  profileAvatarLarge: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
  },
  profileNameLarge: {
    margin: 0,
    fontSize: '2.5rem',
    color: '#FFC700',
  },
  profileEmail: {
    margin: '0.25rem 0 1rem 0',
    fontSize: '1rem',
    color: '#999',
  },
  reviewItem: {
    display: 'flex',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  reviewPoster: {
    width: '100px',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '4px',
    marginRight: '1.5rem',
  },
  reviewTitle: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.5rem',
    color: '#EEE',
  },
  reviewStars: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '1rem',
  },
  reviewText: {
    margin: 0,
    fontSize: '1rem',
    color: '#DDD',
    fontStyle: 'italic',
    lineHeight: 1.6,
  },

  // Movie Detail Page
  movieBackdrop: {
    height: '500px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    borderBottom: '2px solid #FFC700',
  },
  movieBackdropOverlay: {
    height: '100%',
    background: 'linear-gradient(to top, rgba(18, 18, 18, 1) 10%, rgba(18, 18, 18, 0.5) 100%)',
    display: 'flex',
    alignItems: 'flex-end',
  },
  movieHeader: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 2rem 2rem 2rem',
    display: 'flex',
    gap: '2rem',
    alignItems: 'flex-end',
  },
  movieDetailPoster: {
    width: '200px',
    height: '300px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '2px solid #333',
    marginTop: '-100px', // Pulls it down over the backdrop
    position: 'relative',
  },
  movieHeaderInfo: {
    flex: 1,
    paddingBottom: '1rem', // Align with poster bottom
  },
  movieDetailTitle: {
    fontSize: '3rem',
    margin: '0 0 0.5rem 0',
    color: '#FFC700',
  },
  movieDetailTagline: {
    fontSize: '1.2rem',
    color: '#999',
    fontStyle: 'italic',
    margin: '0 0 1rem 0',
  },
  movieDetailMeta: {
    display: 'flex',
    gap: '1.5rem',
    fontSize: '1rem',
    color: '#DDD',
    marginBottom: '1.5rem',
  },
  movieDetailMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  movieDetailActions: {
    display: 'flex',
    gap: '1rem',
  },
  movieDetailActionBtn: {
    padding: '0.5rem 1.5rem',
    background: '#333',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#EEE',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  movieDetailOverview: {
    fontSize: '1.1rem',
    lineHeight: 1.7,
    color: '#DDD',
  },
  genreTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  genreTag: {
    background: '#333',
    color: '#FFC700',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.9rem',
  },
  castGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '1.5rem',
  },
  castMember: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    overflow: 'hidden',
    textAlign: 'center',
  },
  castMemberImg: {
    width: '100%',
    aspectRatio: '2 / 3',
    objectFit: 'cover',
    backgroundColor: '#222',
  },
  castMemberName: {
    display: 'block',
    padding: '0.5rem 0.5rem 0.25rem 0.5rem',
    color: '#EEE',
    fontSize: '0.9rem',
  },
  castMemberChar: {
    display: 'block',
    padding: '0 0.5rem 0.5rem 0.5rem',
    color: '#999',
    fontSize: '0.8rem',
  },
};

export default App;