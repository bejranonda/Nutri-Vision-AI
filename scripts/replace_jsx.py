import sys
import os

FILE_PATH = "frontend/src/app/[locale]/scan/page.tsx"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update basic visibility checks 
content = content.replace("!uploadedImage", "uploadedImages.length === 0")

# 2. Update Image rendering globally 
content = content.replace("uploadedImage &&", "uploadedImages.length > 0 &&")
content = content.replace("{uploadedImage}", "{uploadedImages[0]}")
content = content.replace("src={uploadedImage}", "src={uploadedImages[0]}")

# 3. Add Review Stage before Analyzing Stage
review_stage = """
                {/* Review Stage: Photos uploaded but not analyzed yet */}
                {uploadedImages.length > 0 && !isAnalyzing && !hasResult && !nonFoodReason && !errorMessage && (
                    <div className="backdrop-blur-md bg-white/80 rounded-3xl p-8 max-w-xl mx-auto shadow-glass animate-bounce-in border border-white/40">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">{uploadedImages.length} Photo{uploadedImages.length > 1 ? 's' : ''} Selected</h2>
                            <p className="text-sm text-gray-500">{uploadedImages.length}/{TIER_LIMITS[activeTier].maxPhotosPerScan}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                            {uploadedImages.map((img, idx) => (
                                <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-md relative group">
                                    <img src={img} alt={`Upload ${idx+1}`} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            {canAddMorePhotos(activeTier, uploadedImages.length) && (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-2xl border-2 border-dashed border-brand-primary-300 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-primary-50 transition-colors text-brand-primary-400"
                                >
                                    <Plus className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-semibold">Add Photo</span>
                                </div>
                            )}
                        </div>

                        {!canAddMorePhotos(activeTier, uploadedImages.length) && (
                            <p className="text-sm text-brand-accent-600 mb-6 bg-brand-accent-50 py-2 rounded-xl text-center px-4">
                                You've reached the maximum of {TIER_LIMITS[activeTier].maxPhotosPerScan} photos per scan for your tier.
                            </p>
                        )}
                        
                        <div className="flex gap-4 max-w-md mx-auto">
                            <button onClick={() => setUploadedImages([])} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => handleAnalyze()} className="flex-[2] px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-brand-primary-400 to-brand-secondary-400 shadow-brand hover:shadow-brand-lg transition-all flex items-center justify-center gap-2">
                                <Sparkles className="w-5 h-5" /> Analyze Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Analyzing state */}"""

content = content.replace("{/* Analyzing state */}", review_stage)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("JSX successfully replaced.")
