# Product Entry Form — Five-Mark Solution

A concise five-mark solution using a friendly Windows Forms interface and string
concatenation.

## 1. Proposed form design

```text
PRODUCT ENTRY                                              Add product details

Product name        [ e.g. Notebook                  ]
Category            [ Select a category          v   ]
Price (KES)         [ 0.00                          ]
Quantity            [ 1                             ]

                    [ ADD TO SUMMARY ]  [ CLEAR ]

Summary output
[                                                                    ]
```

| Control | Name | Purpose |
|---|---|---|
| Label + TextBox | `lblProductName` / `txtProductName` | Enter product name |
| Label + ComboBox | `lblCategory` / `cboCategory` | Choose Electronic, Stationary, Beverage, or Food |
| Label + TextBox | `lblPrice` / `txtPrice` | Enter unit price in KES |
| Label + TextBox | `lblQuantity` / `txtQuantity` | Enter quantity |
| Button + TextBox | `btnAdd` / `txtOutput` | Build and display the summary |

User-friendly details: populate the category list at startup, set a clear
default quantity, use readable labels, and display validation messages before
building the summary.

### Five-mark checklist

| Mark | Requirement |
|---|---|
| 1 | Clear labels and suitable input controls |
| 1 | Category ComboBox contains the four required choices |
| 1 | Valid price and quantity are checked |
| 1 | Selections are combined using string concatenation |
| 1 | Result is shown in a read-only output TextBox |

## 2. VB.NET code

Create the controls with the names shown above. Put this code in the form
class. The Add button validates the entries, concatenates the selections, and
displays the result.

```vb
Option Strict On

Private Sub Form1_Load(sender As Object, e As EventArgs) Handles MyBase.Load
    cboCategory.Items.AddRange(New Object() {
        "Electronic", "Stationary", "Beverage", "Food"})
    cboCategory.DropDownStyle = ComboBoxStyle.DropDownList
    txtOutput.ReadOnly = True
End Sub

Private Sub btnAdd_Click(sender As Object, e As EventArgs) Handles btnAdd.Click
    Dim price As Decimal
    Dim quantity As Integer

    If String.IsNullOrWhiteSpace(txtProductName.Text) Then
        MessageBox.Show("Enter a product name.", "Missing information")
        txtProductName.Focus()
        Return
    End If

    If cboCategory.SelectedIndex = -1 Then
        MessageBox.Show("Choose a product category.", "Missing information")
        cboCategory.Focus()
        Return
    End If

    If Not Decimal.TryParse(txtPrice.Text, price) OrElse price < 0D Then
        MessageBox.Show("Enter a valid, non-negative price.", "Invalid price")
        txtPrice.Focus()
        Return
    End If

    If Not Integer.TryParse(txtQuantity.Text, quantity) OrElse quantity < 1 Then
        MessageBox.Show("Enter a whole-number quantity of at least 1.", "Invalid quantity")
        txtQuantity.Focus()
        Return
    End If

    ' Concatenate the user's selections into the output TextBox.
    txtOutput.Text = "Product: " & txtProductName.Text.Trim() &
        " | Category: " & cboCategory.Text &
        " | Price: KES " & price.ToString("0.00") &
        " | Quantity: " & quantity.ToString()
End Sub

Private Sub btnClear_Click(sender As Object, e As EventArgs) Handles btnClear.Click
    txtProductName.Clear()
    cboCategory.SelectedIndex = -1
    txtPrice.Clear()
    txtQuantity.Text = "1"
    txtOutput.Clear()
    txtProductName.Focus()
End Sub
```

### Example output

```text
Product: Notebook | Category: Stationary | Price: KES 120.00 | Quantity: 3
```

> **Note:** “Stationary” follows the category spelling in the assignment image.
> Change the ComboBox item only if your instructor specifies a different
> spelling.
