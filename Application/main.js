        let uploadedImages = [];
        let APIUrl="http://127.0.0.1:8000/predict/";
        // File input handling
        document.getElementById('fileInput').addEventListener('change', handleFiles);

        // Drag and drop
        const uploadSection = document.querySelector('.upload-section');
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            handleFiles(e);
        });

        function handleFiles(e) {
            const files = e.target.files || e.dataTransfer.files;
            for (let file of files) {
                if (file.type.startsWith('image/')) {
                    uploadedImages.push(file);
                    displayImagePreview(file);
                }
            }
            updateAnalyzeButton();
        }

        function displayImagePreview(file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewContainer = document.getElementById('imagePreview');
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="X-ray preview">
                    <button class="remove-btn" onclick="removeImage(${uploadedImages.length - 1})">&times;</button>
                `;
                previewContainer.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        }

        function removeImage(index) {
            uploadedImages.splice(index, 1);
            const previewContainer = document.getElementById('imagePreview');
            if (previewContainer.children[index]) {
                previewContainer.children[index].remove();
            }
            // Rebuild preview to fix indexing
            rebuildImagePreview();
            updateAnalyzeButton();
        }

        function rebuildImagePreview() {
            const previewContainer = document.getElementById('imagePreview');
            previewContainer.innerHTML = '';
            uploadedImages.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.innerHTML = `
                        <img src="${e.target.result}" alt="X-ray preview">
                        <button class="remove-btn" onclick="removeImage(${index})">&times;</button>
                    `;
                    previewContainer.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
        }

        function updateAnalyzeButton() {
            const analyzeBtn = document.getElementById('analyzeBtn');
            analyzeBtn.disabled = uploadedImages.length === 0;
        }

        async function analyzeImages() {
            const resultsDiv = document.getElementById('results');
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <h3>Analyzing X-ray images...</h3>
                    <p>Please wait while our AI processes your images</p>
                </div>
            `;
            let formData= new FormData();
            for(let i=0;i<uploadedImages.length;i++){
                formData.append("images", uploadedImages[i]);
            }
            try {
                const response = await fetch("http://localhost:8000/predict/", {
                method: "POST",
                body: formData,
                });

                if (!response.ok) {
                throw new Error("Prediction request failed");
                }

                const result = await response.json();
                const predictionResults = generateMockResults(result);
                displayResults(predictionResults);
            } catch (error) {
                console.error("Error:", error);
                document.getElementById("results").innerText = "Error occurred during prediction.";
            }

        }

        function generateMockResults(result) {
            // Randomly detect body part from supported list
            const supportedParts = ['ELBOW', 'FINGER', 'FOREARM', 'HAND', 'HUMERUS', 'SHOULDER', 'WRIST'];
            const isNormal = result.predicted_class;
            const confidence = result.confidence; // 80-99%
            
            return {
                status: isNormal == 0 ? 'Normal' : 'Abnormal',
                confidence: (confidence*100).toFixed(0),
                guidance: isNormal == 0 ? 
                    "The X-ray analysis shows no significant abnormalities. The bone structure, joint spaces, and soft tissues appear within normal limits. Continue regular monitoring and maintain good musculoskeletal health practices." :
                    "The analysis detected potential abnormalities that may require medical attention. Please consult with a qualified healthcare professional for proper diagnosis and treatment recommendations. Early intervention can significantly improve outcomes."
            };
        }

        function displayResults(results) {
            const resultsDiv = document.getElementById('results');
            const statusClass = results.status.toLowerCase();
            
            resultsDiv.innerHTML = `
                <h2 style="margin-bottom: 20px; color: #2c3e50;">📊 Analysis Results</h2>
                
                <div class="result-item result-${statusClass}">
                    <div>
                        <p style="color: #666;">Status: <strong>${results.status}</strong></p>
                    </div>
                    <div style="display:flex; gap:5px;flex-direction:row;align-items:center;">
                        <span style="color: #666">Confidence: </span>
                        <div class="confidence ${statusClass}">${results.confidence}%</div>
                    </div>
                </div>
                
                <div class="guidance">
                    <h4 style="margin-bottom: 10px; color: #2c3e50;">📋 Medical Guidance</h4>
                    <p>${results.guidance}</p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(231, 76, 60, 0.1); border-radius: 8px; border-left: 4px solid #e74c3c;">
                    <strong>⚠️ Important Disclaimer:</strong> This AI analysis is for informational purposes only and should not replace professional medical diagnosis. Always consult with qualified healthcare professionals for accurate diagnosis and treatment.
                </div>
            `;
        }
