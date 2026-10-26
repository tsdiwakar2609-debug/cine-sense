import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { Heart, Clock, Search, Home, BarChart3, Star, Users, Film, Eye, TrendingUp, Calendar, Filter } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ============= FIREBASE/FIRESTORE IMPORTS =============
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, runTransaction } from 'firebase/firestore';

// ============= TMDB API CONFIGURATION =============
// NOTE: In a production app, the API key should be securely handled server-side.
const TMDB_API_KEY = '1bc99f4e97b80cf35c10fad2f122d658'; // Replace with your actual API key
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// ============= CONTEXT & ROUTING =============
const AuthContext = createContext(null);
const DataContext = createContext(null);
const RouterContext = createContext(null);

const useAuth = () => useContext(AuthContext);
const useData = () => useContext(DataContext);
const useRouter = () => useContext(RouterContext);

// Utility function for fetching
const fetchTmdb = async (endpoint) => {
    const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error("TMDB Fetch Error:", error);
        return { results: [] };
    }
};

// ============= FIREBASE DATA PROVIDER =============

const FirebaseDataProvider = ({ children }) => {
    const [db, setDB] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userData, setUserData] = useState([]); // Movies the user has interacted with
    const [genres, setGenres] = useState([]); // All available genres from TMDB

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    
    // 1. Initialization and Authentication
    useEffect(() => {
        if (Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase config is missing.");
            return;
        }

        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        setDB(dbInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (!user) {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (e) {
                    console.error("Auth failed, signing in anonymously:", e);
                    await signInAnonymously(authInstance);
                }
            }
            
            setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
            setIsAuthReady(true);
            setAuth(authInstance);
        });

        return () => unsubscribe();
    }, []);

    // 2. Real-time Data Listener (onSnapshot)
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;

        // Path: /artifacts/{appId}/users/{userId}/cine_sense_data
        const userMoviesRef = collection(db, `artifacts/${appId}/users/${userId}/cine_sense_data`);
        
        // This is the core BI data source: fetching all tracked user movies in real-time
        const unsubscribe = onSnapshot(userMoviesRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUserData(data);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady, appId]);

    // 3. Fetch Genres from TMDB
    useEffect(() => {
        fetchTmdb('/genre/movie/list').then(data => {
            if (data && data.genres) {
                setGenres(data.genres);
            }
        });
    }, []);

    // Async Data Management Functions
    const toggleStatus = async (movie, statusType, value) => {
        if (!db || !userId) {
            console.error("Database or User ID not ready.");
            return;
        }

        const docRef = doc(db, `artifacts/${appId}/users/${userId}/cine_sense_data`, String(movie.id));

        // Data stored in Firestore for BI analysis
        const dataToUpdate = {
            id: movie.id,
            title: movie.title,
            release_date: movie.release_date,
            genres: movie.genre_ids, // IMPORTANT: Array of TMDB genre IDs for BI processing
            runtime: movie.runtime || 0,
        };
        
        // Use transaction for reliable update
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(docRef);
            let update = {};

            if (sfDoc.exists()) {
                update = sfDoc.data();
            }

            // Status handling logic
            if (statusType === 'rating') {
                update.rating = value;
                update.rated_at = Date.now();
            } else {
                // If it's a binary toggle (watched/watchlist)
                const isToggledOn = !update[statusType]; // Toggle the status
                
                if (isToggledOn) {
                    update[statusType] = true;
                    if (statusType === 'watched') {
                        update.watched_at = Date.now();
                        update.watchlist = false; // Remove from watchlist if watched
                    } else if (statusType === 'watchlist') {
                        update.watchlist_at = Date.now();
                    }
                } else {
                    delete update[statusType];
                    if (statusType === 'watched') delete update.watched_at;
                    if (statusType === 'watchlist') delete update.watchlist_at;
                }
            }

            // Merge with base movie data and update Firestore
            transaction.set(docRef, { ...dataToUpdate, ...update }, { merge: true });
        });
    };

    const getGenreName = (id) => {
        const genre = genres.find(g => g.id === id);
        return genre ? genre.name : 'Unknown';
    };

    const value = useMemo(() => ({
        userData,
        userId,
        isAuthReady,
        toggleStatus,
        getGenreName,
        genres,
    }), [userData, userId, isAuthReady, genres]);

    return (
        <DataContext.Provider value={value}>
            <AuthContext.Provider value={{ userId, isAuthReady }}>
                {children}
            </AuthContext.Provider>
        </DataContext.Provider>
    );
};

// ============= ROUTER IMPLEMENTATION =============
const Router = ({ children }) => {
    const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');
    
    useEffect(() => {
        const handleHashChange = () => setCurrentPath(window.location.hash.slice(1) || '/');
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const navigate = (path) => {
        window.location.hash = path;
    };

    const value = useMemo(() => ({ currentPath, navigate }), [currentPath]);

    return (
        <RouterContext.Provider value={value}>
            {React.Children.map(children, child => {
                if (child.props.path === currentPath) {
                    return child;
                }
                return null;
            })}
        </RouterContext.Provider>
    );
};

const Route = ({ path, element }) => {
    return element; // Logic handled by Router component
};

// ============= UI COMPONENTS =============

const Sidebar = () => {
    const { navigate } = useRouter();
    const { userId } = useAuth();
    const navItems = [
        { path: '/', icon: Home, label: 'Home' },
        { path: '/search', icon: Search, label: 'Search' },
        { path: '/watchlist', icon: Clock, label: 'Watchlist' },
        { path: '/watched', icon: Eye, label: 'Watched' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    ];

    return (
        <div className="w-64 bg-gray-900 text-white flex flex-col p-4 shadow-xl h-full fixed left-0 top-0">
            <h1 className="text-3xl font-bold mb-8 text-indigo-400">Cine-Sense BI</h1>
            <div className="flex-grow space-y-2">
                {navItems.map(item => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className="w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <item.icon className="w-5 h-5" />
                        <span className="text-lg">{item.label}</span>
                    </button>
                ))}
            </div>
            <div className="mt-8 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">User ID:</p>
                <p className="text-xs break-all text-indigo-300 font-mono">{userId || 'Loading...'}</p>
            </div>
        </div>
    );
};

const MainContent = ({ children }) => (
    <div className="flex-grow p-8 ml-64 min-h-screen bg-gray-800 text-white">
        {children}
    </div>
);

const MovieCard = ({ movie, actionButton, linkPath }) => {
    const { navigate } = useRouter();
    const imagePath = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://placehold.co/500x750/1f2937/d1d5db?text=No+Image';

    return (
        <div className="bg-gray-700 rounded-lg shadow-lg overflow-hidden transition-transform duration-300 hover:scale-[1.03] flex flex-col">
            <div 
                className="relative cursor-pointer"
                onClick={() => navigate(linkPath || `/movie/${movie.id}`)}
            >
                <img 
                    src={imagePath} 
                    alt={movie.title} 
                    className="w-full h-72 object-cover"
                    onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = 'https://placehold.co/500x750/1f2937/d1d5db?text=No+Image';
                    }}
                />
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold p-1 rounded-bl-lg">
                    {movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
                </div>
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2">{movie.title}</h3>
                <p className="text-sm text-gray-400 mb-3 flex-grow">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</p>
                {actionButton && <div className="mt-auto">{actionButton}</div>}
            </div>
        </div>
    );
};

// ============= PAGES =============

const HomePage = () => {
    const [trending, setTrending] = useState([]);

    useEffect(() => {
        // Fetch trending movies on load
        fetchTmdb('/trending/movie/day').then(data => setTrending(data.results));
    }, []);

    return (
        <div>
            <h2 className="text-4xl font-extrabold mb-8 text-indigo-400">Today's Trending Content</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {trending.map(movie => <MovieCard key={movie.id} movie={movie} />)}
            </div>
        </div>
    );
};

const SearchPage = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        const data = await fetchTmdb(`/search/movie?query=${encodeURIComponent(query)}`);
        setResults(data.results || []);
        setLoading(false);
    };

    return (
        <div>
            <h2 className="text-4xl font-extrabold mb-6 text-indigo-400">Search Cinematic Database</h2>
            <div className="flex gap-4 mb-8">
                <input
                    type="text"
                    placeholder="Enter movie title..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-grow p-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                    onClick={handleSearch}
                    className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors flex items-center gap-2"
                    disabled={loading}
                >
                    <Search className="w-5 h-5" />
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>
            {loading && <p className="text-center text-indigo-400">Loading results...</p>}
            
            {!loading && results.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {results.map(movie => <MovieCard key={movie.id} movie={movie} />)}
                </div>
            )}
             {!loading && results.length === 0 && query.trim() && (
                <p className="text-center text-gray-400">No results found for "{query}".</p>
            )}
        </div>
    );
};

const MovieDetail = () => {
    const { currentPath } = useRouter();
    const { toggleStatus, userData } = useData();
    const movieId = currentPath.split('/')[2];
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);

    const currentData = userData.find(d => d.id === Number(movieId)) || {};
    const isWatched = !!currentData.watched;
    const isWatchlist = !!currentData.watchlist;
    const currentRating = currentData.rating || 0;

    useEffect(() => {
        setLoading(true);
        // Fetch details (including runtime and genres which are needed for BI)
        fetchTmdb(`/movie/${movieId}`).then(data => {
            setMovie(data);
            setLoading(false);
        });
    }, [movieId]);

    if (loading) return <div className="text-center text-2xl mt-12 text-indigo-400">Loading movie details...</div>;
    if (!movie) return <div className="text-center text-2xl mt-12 text-red-400">Movie not found.</div>;

    const genresList = movie.genres?.map(g => g.name).join(', ') || 'N/A';
    const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';

    // Extend movie object with runtime and genre_ids for storage
    // This object ensures the data saved to Firestore is clean and ready for BI.
    const movieDataForSave = {
        ...movie,
        runtime: movie.runtime,
        genre_ids: movie.genres?.map(g => g.id) || [],
    };

    const handleRating = async (rating) => {
        await toggleStatus(movieDataForSave, 'rating', rating);
    };

    return (
        <div className="max-w-4xl mx-auto bg-gray-700 rounded-xl shadow-2xl overflow-hidden p-8">
            <div className="flex flex-col md:flex-row gap-8">
                <img 
                    src={movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://placehold.co/500x750/1f2937/d1d5db?text=No+Image'} 
                    alt={movie.title} 
                    className="w-full md:w-64 h-auto object-cover rounded-lg shadow-xl"
                />
                <div className="flex-1">
                    <h2 className="text-4xl font-bold mb-4 text-indigo-400">{movie.title}</h2>
                    
                    {/* Metadata Section */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-gray-300 mb-6">
                        <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> <span>{releaseYear}</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <Clock className="w-4 h-4" /> <span>{movie.runtime} min</span>
                        </p>
                        <p className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> <span>{movie.vote_average?.toFixed(1)} (TMDB)</span>
                        </p>
                    </div>

                    {/* BI Action Buttons */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <button
                            onClick={() => toggleStatus(movieDataForSave, 'watchlist', !isWatchlist)}
                            className={`p-2 rounded-full transition-all flex items-center gap-2 text-sm font-medium ${isWatchlist ? 'bg-yellow-500 text-gray-900' : 'bg-gray-800 text-white hover:bg-gray-600'}`}
                        >
                            <Clock className="w-4 h-4" /> {isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                        </button>
                        <button
                            onClick={() => toggleStatus(movieDataForSave, 'watched', !isWatched)}
                            className={`p-2 rounded-full transition-all flex items-center gap-2 text-sm font-medium ${isWatched ? 'bg-green-500 text-gray-900' : 'bg-gray-800 text-white hover:bg-gray-600'}`}
                        >
                            <Eye className="w-4 h-4" /> {isWatched ? 'Watched' : 'Mark as Watched'}
                        </button>
                    </div>

                    {/* Rating Input */}
                    <div className="mb-8">
                        <p className="text-lg font-semibold mb-2">Your Rating ({currentRating}/5):</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <Star
                                    key={star}
                                    className={`w-8 h-8 cursor-pointer transition-colors ${star <= currentRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`}
                                    onClick={() => handleRating(star)}
                                />
                            ))}
                        </div>
                    </div>

                    <h3 className="text-xl font-semibold mb-2 text-indigo-300">Overview</h3>
                    <p className="text-gray-300 mb-6">{movie.overview || 'No overview available.'}</p>

                    <h3 className="text-xl font-semibold mb-2 text-indigo-300">Genres</h3>
                    <p className="text-gray-300">{genresList}</p>
                </div>
            </div>
        </div>
    );
};

const WatchlistPage = () => {
    const { userData } = useData();
    const watchlistMovies = userData.filter(d => d.watchlist);

    return (
        <div>
            <h2 className="text-4xl font-extrabold mb-8 text-yellow-400 flex items-center gap-3">
                <Clock className="w-8 h-8" /> Your Watchlist ({watchlistMovies.length})
            </h2>
            {watchlistMovies.length === 0 ? (
                <p className="text-lg text-gray-400">Your watchlist is empty. Find some movies to add!</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {watchlistMovies.map(movie => (
                        <MovieCard key={movie.id} movie={{ id: movie.id, title: movie.title, poster_path: movie.poster_path, release_date: movie.release_date }} />
                    ))}
                </div>
            )}
        </div>
    );
};

const WatchedPage = () => {
    const { userData } = useData();
    const watchedMovies = userData.filter(d => d.watched).sort((a, b) => (b.watched_at || 0) - (a.watched_at || 0));

    return (
        <div>
            <h2 className="text-4xl font-extrabold mb-8 text-green-400 flex items-center gap-3">
                <Eye className="w-8 h-8" /> Watched History ({watchedMovies.length})
            </h2>
            {watchedMovies.length === 0 ? (
                <p className="text-lg text-gray-400">You haven't marked any movies as watched yet.</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {watchedMovies.map(movie => (
                        <MovieCard key={movie.id} movie={{ id: movie.id, title: movie.title, poster_path: movie.poster_path, release_date: movie.release_date }} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ============= ANALYTICS DASHBOARD (BI CORE) =============

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00c49f', '#ffbb28'];

const processAnalyticsData = (userData, genres) => {
    const watchedMovies = userData.filter(d => d.watched);
    
    // Total Watched Movies and Total Runtime
    const totalWatched = watchedMovies.length;
    const totalRuntime = watchedMovies.reduce((sum, movie) => sum + (movie.runtime || 0), 0);

    // --- GENRE DISTRIBUTION (The Real-Time BI Calculation) ---
    const genreCounts = {};
    watchedMovies.forEach(movie => {
        // 1. Iterate through the array of genre IDs saved in Firestore (e.g., [28, 12, 878])
        movie.genres?.forEach(genreId => {
            // 2. Map the ID to the Name using the TMDB genres list
            const genreName = genres.find(g => g.id === genreId)?.name || 'Unknown';
            // 3. Aggregate the count for the genre name
            genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
        });
    });
    // 4. Transform the object map into the array format needed by Recharts
    const genreDistribution = Object.entries(genreCounts).map(([name, value]) => ({ name, value }));
    // --------------------------------------------------------
    
    // Rating Distribution
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;
    let ratedCount = 0;
    
    watchedMovies.forEach(movie => {
        if (movie.rating && movie.rating >= 1 && movie.rating <= 5) {
            ratingCounts[movie.rating] += 1;
            ratingSum += movie.rating;
            ratedCount++;
        }
    });
    const ratingDistribution = Object.entries(ratingCounts).map(([name, count]) => ({ 
        name: `${name} Star`, 
        count 
    }));
    const averageRating = ratedCount > 0 ? (ratingSum / ratedCount).toFixed(2) : 'N/A';

    // Top-rated Genre for Recommendations 
    const genreRatings = {};
    watchedMovies.forEach(movie => {
        if (movie.rating) {
            movie.genres?.forEach(genreId => {
                const genreName = genres.find(g => g.id === genreId)?.name || 'Unknown';
                if (!genreRatings[genreName]) {
                    genreRatings[genreName] = { totalRating: 0, count: 0 };
                }
                genreRatings[genreName].totalRating += movie.rating;
                genreRatings[genreName].count += 1;
            });
        }
    });

    const genreAverages = Object.entries(genreRatings)
        .filter(([, data]) => data.count >= 3) // Only consider genres with at least 3 rated movies
        .map(([name, data]) => ({ name, average: data.totalRating / data.count }))
        .sort((a, b) => b.average - a.average);

    const topRatedGenre = genreAverages.length > 0 ? genreAverages[0].name : null;


    return {
        totalWatched,
        totalRuntime,
        averageRating,
        genreDistribution,
        ratingDistribution,
        topRatedGenre,
        watchedMovies,
    };
};

const PerformanceMetrics = ({ totalWatched, totalRuntime, averageRating }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <MetricCard title="Total Watched" value={totalWatched} icon={Film} color="text-indigo-400" />
        <MetricCard title="Total Runtime (Min)" value={totalRuntime} icon={Clock} color="text-yellow-400" />
        <MetricCard title="Average Rating" value={averageRating} icon={Star} color="text-green-400" />
    </div>
);

const MetricCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-gray-700 p-6 rounded-xl shadow-lg flex items-center justify-between">
        <div>
            <p className="text-sm font-medium text-gray-400 uppercase">{title}</p>
            <p className="text-3xl font-bold mt-1 text-white">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
    </div>
);

const RecommendationCard = ({ topGenre }) => {
    return (
        <div className="bg-gray-700 p-6 rounded-xl shadow-lg border-l-4 border-red-500">
            <h3 className="text-xl font-semibold mb-3 text-red-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" /> Recommended for You
            </h3>
            {topGenre ? (
                <p className="text-lg text-white">
                    Based on your high ratings, you seem to enjoy **{topGenre}** movies. Start searching for more!
                </p>
            ) : (
                <p className="text-lg text-gray-400">
                    Rate at least 3 movies across a few genres to unlock personalized recommendations.
                </p>
            )}
        </div>
    );
};


const AnalyticsDashboard = () => {
    const { userData, genres, getGenreName } = useData();
    
    // State for Advanced Filtering (OLAP Slicing)
    const [filterGenre, setFilterGenre] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Process data, applying filters dynamically (OLAP Slicing)
    const processedData = useMemo(() => {
        let filteredData = userData.filter(d => d.watched);
        
        // 1. Apply Genre Filter
        if (filterGenre) {
            const genreId = genres.find(g => g.name === filterGenre)?.id;
            if (genreId) {
                filteredData = filteredData.filter(movie => 
                    movie.genres && movie.genres.includes(genreId)
                );
            }
        }

        // 2. Apply Year Filter
        if (filterYear) {
            filteredData = filteredData.filter(movie => 
                movie.release_date && new Date(movie.release_date).getFullYear() === Number(filterYear)
            );
        }

        // Process the filtered subset of data for charts
        return processAnalyticsData(filteredData, genres);
    }, [userData, genres, filterGenre, filterYear]);

    const { 
        totalWatched, 
        totalRuntime, 
        averageRating, 
        genreDistribution, 
        ratingDistribution,
        topRatedGenre,
        watchedMovies
    } = processedData;
    
    // Unique Filter Options
    const allWatchedYears = Array.from(new Set(
        watchedMovies
            .map(m => m.release_date ? new Date(m.release_date).getFullYear() : null)
            .filter(y => y)
    )).sort((a, b) => b - a);

    const allWatchedGenres = Array.from(new Set(
        watchedMovies.flatMap(m => m.genres || []).map(getGenreName)
    )).sort();


    if (watchedMovies.length === 0) {
        return <div className="text-center text-2xl mt-12 text-gray-400">Mark some movies as watched and rated to unlock your BI dashboard!</div>;
    }

    return (
        <div>
            <h2 className="text-4xl font-extrabold mb-4 text-indigo-400">Cinematic BI Dashboard</h2>
            <p className="text-gray-300 mb-8">Data driven insights into your content consumption patterns.</p>

            <RecommendationCard topGenre={topRatedGenre} />
            
            <PerformanceMetrics 
                totalWatched={totalWatched} 
                totalRuntime={totalRuntime} 
                averageRating={averageRating} 
            />

            {/* Advanced Filters (OLAP Slicing) */}
            <div className="flex flex-wrap gap-4 mb-10 bg-gray-700 p-4 rounded-xl items-center">
                <Filter className="w-5 h-5 text-indigo-300" />
                <span className="text-lg font-semibold text-white mr-4">Data Filters (OLAP Slicing):</span>
                
                <select 
                    value={filterGenre} 
                    onChange={(e) => setFilterGenre(e.target.value)}
                    className="p-2 rounded bg-gray-800 text-white border border-gray-600 focus:ring-indigo-500"
                >
                    <option value="">All Genres</option>
                    {allWatchedGenres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                    ))}
                </select>

                <select 
                    value={filterYear} 
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="p-2 rounded bg-gray-800 text-white border border-gray-600 focus:ring-indigo-500"
                >
                    <option value="">All Years</option>
                    {allWatchedYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>

                <button 
                    onClick={() => { setFilterGenre(''); setFilterYear(''); }}
                    className="p-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                >
                    Clear Filters
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Genre Distribution Chart */}
                <div className="bg-gray-700 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4 text-indigo-300">Genre Consumption Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={genreDistribution}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {genreDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '4px' }}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Rating Distribution Chart */}
                <div className="bg-gray-700 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4 text-indigo-300">User Rating Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={ratingDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                            <XAxis dataKey="name" stroke="#d1d5db" />
                            <YAxis stroke="#d1d5db" />
                            <Tooltip contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '4px' }} />
                            <Legend />
                            <Bar dataKey="count" fill="#82ca9d" name="Count of Ratings" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};


// ============= MAIN APP COMPONENT =============

const App = () => {
    return (
        <div className="flex min-h-screen">
            <Router>
                <FirebaseDataProvider>
                    <Sidebar />
                    <MainContent>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/search" element={<SearchPage />} />
                        <Route path="/movie/:id" element={<MovieDetail />} />
                        <Route path="/watchlist" element={<WatchlistPage />} />
                        <Route path="/watched" element={<WatchedPage />} />
                        <Route path="/analytics" element={<AnalyticsDashboard />} />
                        {/* Fallback Route */}
                        <Route path="/404" element={<div className="text-center text-3xl mt-12 text-red-400">404 - Page Not Found</div>} />
                    </MainContent>
                </FirebaseDataProvider>
            </Router>
        </div>
    );
};

export default App;
