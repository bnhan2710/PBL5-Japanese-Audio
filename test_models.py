from gradio_client import Client
client = Client("http://127.0.0.1:7861")
info = client.view_api(return_format="dict")
print(info['named_endpoints']['/update_model_files_for_gradio']['parameters'][0]['type']['enum'])
